<!--
  C 端 OAuth 回调页（zhao-third 体系）

  适用场景：
  - 三方登录模式（authConfig.mode === 'third'）下的微信公众号/开放平台登录回调
  - 接收微信 OAuth code，POST /zhao-third/v1/third/callback 换 token

  不适用场景：
  - SSO 模式（authConfig.mode === 'sso'）的回调。SSO 模式下：
    1. SSO 后端 wechatCallback/alipayCallback 302 回 SSO 的 login-callback?code=xxx&state=xxx
    2. SSO login-callback.vue 调 /zhao-sso/v1/auth/exchange-token 换 token
    3. login-callback 再 302 回本页（auth-callback?token=xxx&user=base64(json)）
    4. 本页识别到 token 参数后直接写入并跳首页

  即：SSO 模式下本页只负责"接收 token 并跳首页"这一步，不调 zhao-third 接口。
  两条分支由 URL 参数区分：有 token 走 SSO 路径，有 code 走 zhao-third 路径。
-->
<template>
  <view class="auth-callback">
    <view class="loading-container">
      <view class="loading-spinner"></view>
      <text class="loading-text">{{ statusText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { request } from '../../services/api'
import { setToken, setUser } from '../../utils/storage'
import { bindInviteCodesAfterLogin } from '../../utils/invite'

const statusText = ref('微信登录中...')

onMounted(async () => {
  // #ifdef H5
  await handleOAuthCallback()
  // #endif
})

// #ifdef H5
// === 兜底建立分销关系（SSO 路径 + third 路径共用） ===
async function bindInviteCodesAfterCallback() {
  await bindInviteCodesAfterLogin()
}

async function handleOAuthCallback() {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const hashQuery = window.location.hash.split('?')[1] || ''
    const hashParams = new URLSearchParams(hashQuery)

    const token = urlParams.get('token') || hashParams.get('token')
    const userId = urlParams.get('userId') || hashParams.get('userId')
    const userEncoded = urlParams.get('user') || hashParams.get('user')
    const isNew = urlParams.get('isNew') || hashParams.get('isNew')
    // state 语义（Type C）：登录后目标导航路径（如 /pages/course/detail?id=123），
    // 由 zhao-third OAuth 流程透传回来；SSO 流程不传此参数，state 为 null 时回退到首页。
    // 与 SSO 后端的 Type A（base64url JSON 信封）和 Type B（OAuth2 透传）语义均不同。
    const state = urlParams.get('state') || hashParams.get('state')
    const error = urlParams.get('error') || hashParams.get('error')

    if (error) {
      statusText.value = `登录失败: ${decodeURIComponent(error)}`
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/login' })
      }, 2000)
      return
    }

    if (token) {
      setToken(token)
      // 关键：保存 refresh_token 和 expires_in，否则 access_token 过期后无法刷新（SSO 无法持久）
      const refreshTokenVal = urlParams.get('refresh_token') || hashParams.get('refresh_token') || ''
      const expiresInVal = urlParams.get('expires_in') || hashParams.get('expires_in') || '900'
      if (refreshTokenVal) {
        uni.setStorageSync('refresh_token', refreshTokenVal)
        // 提前 60 秒标记过期，触发主动刷新（与 services/api.ts 的 isTokenExpiring 逻辑一致）
        uni.setStorageSync('token_expires_at', String(Date.now() + (Number(expiresInVal) - 60) * 1000))
      }
      // 优先解析 user 参数（SSO 登录/注册回跳携带的完整用户对象）
      if (userEncoded) {
        try {
          const user = JSON.parse(decodeURIComponent(atob(userEncoded)))
          setUser(user)
        } catch {
          if (userId) setUser({ id: Number(userId) })
        }
      } else if (userId) {
        setUser({ id: Number(userId) })
      }
      // isNew='1' 标识首登用户，存 storage 供首页显示欢迎提示（消费后由首页清除）
      if (isNew === '1' || isNew === 'true' || isNew === 1) {
        uni.setStorageSync('isNewUser', '1')
      }
      statusText.value = '登录成功，正在跳转...'

      window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
      // 兜底建立分销关系（成功才清除 inviteCode/channelInviteCode，失败保留下次再试）
      await bindInviteCodesAfterCallback()
      // 清理无关 storage（非邀请码）
      uni.removeStorageSync('wxAuthScope')
      uni.removeStorageSync('wxAuthAppType')
      uni.removeStorageSync('h5AutoLoginAttemptedAt')
      uni.removeStorageSync('h5WechatAutoLoginRetries')

      setTimeout(() => {
        if (state) {
          try {
            const targetUrl = decodeURIComponent(state)
            if (targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
              uni.reLaunch({ url: targetUrl })
              return
            }
          } catch {}
        }
        uni.switchTab({ url: '/pages/index/index' })
      }, 500)
      return
    }

    const code = urlParams.get('code') || hashParams.get('code')

    if (!code) {
      statusText.value = '授权失败，正在跳转...'
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/login/login' })
      }, 1500)
      return
    }

    const scope = uni.getStorageSync('wxAuthScope') ?? 'snsapi_base'
    const appType = uni.getStorageSync('wxAuthAppType') ?? 'official_account'
    const inviteCode = uni.getStorageSync('inviteCode') || undefined
    const channelInviteCode = uni.getStorageSync('channelInviteCode') || undefined

    const res = await request('/zhao-third/v1/third/callback', {
      method: 'POST',
      data: {
        platform: 'wechat',
        appType,
        code,
        inviteCode,
        channelInviteCode,
        scope,
      }
    }) as any

    const callbackToken = res.jwt ?? res.token
    if (callbackToken) {
      setToken(callbackToken)
      if (res.user) setUser(res.user)
      // zhao-third 返回 isNew 标识首登用户
      if (res.isNew === true || res.is_new === true) {
        uni.setStorageSync('isNewUser', '1')
      }
      statusText.value = '登录成功，正在跳转...'

      window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
      // 兜底建立分销关系（覆盖后端 createForUser 失败/老用户不处理/channelInviteCode 丢弃）
      await bindInviteCodesAfterCallback()
      // 清理无关 storage（非邀请码）
      uni.removeStorageSync('wxAuthScope')
      uni.removeStorageSync('wxAuthAppType')
      uni.removeStorageSync('h5AutoLoginAttemptedAt')
      uni.removeStorageSync('h5WechatAutoLoginRetries')

      setTimeout(() => {
        if (state) {
          try {
            const targetUrl = decodeURIComponent(state)
            if (targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
              uni.reLaunch({ url: targetUrl })
              return
            }
          } catch {}
        }
        uni.switchTab({ url: '/pages/index/index' })
      }, 500)
    } else {
      throw new Error('未获取到 token')
    }
  } catch (err: any) {
    console.error('[auth-callback] 微信登录失败:', err)
    statusText.value = '登录失败，正在跳转...'
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/login' })
    }, 1500)
  }
}
// #endif
</script>

<style scoped>
.auth-callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #e0e0e0;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 30rpx;
  color: #666;
}
</style>
