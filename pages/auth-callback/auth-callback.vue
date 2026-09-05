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
import { bindInviteCodesAfterLogin, trackInviteFlow } from '../../utils/invite'

const statusText = ref('微信登录中...')

onMounted(async () => {
  // #ifdef H5
  await handleOAuthCallback()
  // #endif
})

// #ifdef H5
// === 登录后对齐 up_users：把 SSO 返回的真实邀请码/昵称/头像写入 C 端 up_users ===
// SSO user 对象含 ssoId + inviteCode（真实 ownInviteCode）；仅 SSO 身份时同步；失败不影响登录。
async function syncSsoProfileAfterLogin(userObj: any) {
  try {
    const ssoId = Number(userObj?.ssoId ?? userObj?.ssoUserId ?? userObj?.sso_id)
    if (!Number.isInteger(ssoId) || ssoId <= 0) return
    await request('/zhao-auth/v1/auth/sync-sso-profile', {
      method: 'POST',
      data: {
        ssoId,
        inviteCode: userObj?.inviteCode || userObj?.ownInviteCode || '',
        nickname: userObj?.nickname || userObj?.name || '',
        avatar: userObj?.avatar || userObj?.avatar_url || '',
      },
    })
  } catch (e) {
    // 对齐失败不阻断登录，下次登录/懒对齐兜底
    console.warn('[auth-callback] syncSsoProfile 失败', e)
  }
}
// === 兜底建立分销关系（SSO 路径 + third 路径共用） ===
async function bindInviteCodesAfterCallback() {
  await bindInviteCodesAfterLogin()
}

/**
 * 解析 JWT 的 exp 写入 token_expires_at，使 services/api.ts 的 isTokenExpiring 生效。
 * 三方(zhao-third)登录不签发 refresh_token，无法走刷新接口提前换新，
 * 但记录过期点后，token 过期时能按"静默重授权续期"兜底而非反复弹登录。
 */
function writeTokenExpiryFromJwt(token: string): void {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const exp = payload?.exp
    if (typeof exp === 'number') {
      // 提前 60 秒标记过期，触发主动续期（与 services/api.ts 的 isTokenExpiring 逻辑一致）
      uni.setStorageSync('token_expires_at', String(exp * 1000 - 60000))
    }
  } catch {
    // JWT 非法或无法解析时忽略，交由 401 兜底处理
  }
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
      // 埋点：登录回调成功（token 已保存），记录此时 storage/用户中的邀请码
      trackInviteFlow('login_callback', {
        storedCode: uni.getStorageSync('inviteCode') || '',
        inviteCode: (JSON.parse(decodeURIComponent(atob(userEncoded || 'e30='))) as any)?.inviteCode || '',
        pagePath: window.location.href,
        loggedIn: !!token,
        success: !!token,
        userId: Number(userId || 0) || undefined,
      })
      // 登录后对齐：把 SSO 真实邀请码写入 C 端 up_users（用户对象在 setUser 前可用）
      if (userEncoded) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(atob(userEncoded)))
          await syncSsoProfileAfterLogin(parsedUser)
        } catch {
          // user 参数解析失败仅影响对齐，不影响登录
        }
      }
      // 清理无关 storage（非邀请码）
      uni.removeStorageSync('wxAuthScope')
      uni.removeStorageSync('wxAuthAppType')
      uni.removeStorageSync('h5AutoLoginAttemptedAt')
      uni.removeStorageSync('h5WechatAutoLoginRetries')
      // 清理 401 静默重授权计数（services/api.ts silentReauthWechat）
      uni.removeStorageSync('h5SilentReauthCount')

      setTimeout(() => {
        if (state) {
          try {
            const targetUrl = decodeURIComponent(state)
            if (targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
              // 埋点：回跳到来源页（state 指向），判定「应回兑换页却回首页」
              trackInviteFlow('redirect_back', { success: true, pagePath: targetUrl, loggedIn: true, detail: `reLaunch:${targetUrl}` })
              uni.reLaunch({ url: targetUrl })
              return
            }
          } catch {}
        }
        // 埋点：无 state → 回退首页
        trackInviteFlow('redirect_back', { success: false, pagePath: '/pages/index/index', loggedIn: true, detail: 'switchTab home' })
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
      // 三方登录无 refresh_token：记录 JWT exp，使前端能在 token 过期时走静默重授权续期兜底
      writeTokenExpiryFromJwt(callbackToken)
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
              // 埋点：回跳到来源页（state 指向），判定「应回兑换页却回首页」
              trackInviteFlow('redirect_back', { success: true, pagePath: targetUrl, loggedIn: true, detail: `reLaunch:${targetUrl}` })
              uni.reLaunch({ url: targetUrl })
              return
            }
          } catch {}
        }
        // 埋点：无 state → 回退首页
        trackInviteFlow('redirect_back', { success: false, pagePath: '/pages/index/index', loggedIn: true, detail: 'switchTab home' })
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
