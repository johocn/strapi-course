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

const statusText = ref('微信登录中...')

onMounted(async () => {
  // #ifdef H5
  await handleOAuthCallback()
  // #endif
})

// #ifdef H5
async function handleOAuthCallback() {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const hashQuery = window.location.hash.split('?')[1] || ''
    const hashParams = new URLSearchParams(hashQuery)

    const token = urlParams.get('token') || hashParams.get('token')
    const userId = urlParams.get('userId') || hashParams.get('userId')
    const isNew = urlParams.get('isNew') || hashParams.get('isNew')
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
      if (userId) {
        setUser({ id: Number(userId) })
      }
      statusText.value = '登录成功，正在跳转...'

      window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
      uni.removeStorageSync('wxAuthScope')
      uni.removeStorageSync('wxAuthAppType')
      uni.removeStorageSync('inviteCode')
      uni.removeStorageSync('channelInviteCode')
      uni.removeStorageSync('h5AutoLoginAttemptedAt')

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
      statusText.value = '登录成功，正在跳转...'

      window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
      uni.removeStorageSync('wxAuthScope')
      uni.removeStorageSync('wxAuthAppType')
      uni.removeStorageSync('inviteCode')
      uni.removeStorageSync('channelInviteCode')
      uni.removeStorageSync('h5AutoLoginAttemptedAt')

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
