<script>
import { validateLogin, redirectToLogin, getCurrentPagePath, isAuthPage } from './utils/auth'
import { handleInviteLink } from './utils/invite'
import { fetchAuthConfig, getStoredAuthConfig } from './services/auth-config'
import { getUser } from './utils/storage'
import { applyTheme } from './utils/theme'

// #ifdef MP-WEIXIN
import { silentLogin, checkAndAuthorize } from './utils/wx-login'
// #endif

// #ifdef H5
import { isWechatBrowser } from './utils/env'
import { initJSSDK, configShareWithInvite, setPageShare } from './utils/wx-jssdk'
import { redirectToWechatAuth } from './utils/wx-h5-login'

// 暴露 setPageShare 到全局，供各页面 onShow 调用
if (typeof window !== 'undefined') {
  window.setPageShare = setPageShare
}
// #endif

export default {
  onLaunch: async function() {
    console.log('App Launch')

    // 清除旧的 mock token，切到游客模式
    const existingToken = uni.getStorageSync('token')
    if (existingToken && (existingToken.startsWith('mock_jwt_') || existingToken.startsWith('mock_'))) {
      uni.removeStorageSync('token')
      uni.removeStorageSync('user')
      uni.setStorageSync('isGuest', 'true')
      console.log('已清除 mock token，切换为游客模式')
    }

    // 1. 处理邀请链接参数（优先级最高）
    handleInviteLink()

    // 2. 引导页判断（仅首次未登录且无完成标记时显示）
    //    - H5 携带业务参数（token/code/inviteCode 等）时跳过，避免打断登录回调/邀请/分享进入
    //    - 已登录（有 token）或已完成引导（guideCompleted==='true'）时跳过
    const guideCompleted = uni.getStorageSync('guideCompleted') === 'true'
    const hasToken = !!uni.getStorageSync('token')

    let shouldSkipGuide = hasToken || guideCompleted
    // #ifdef H5
    if (!shouldSkipGuide && typeof window !== 'undefined' && window.location) {
      const hashQuery = window.location.hash.split('?')[1] || ''
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(hashQuery)
      // 携带以下任一参数视为"带目的而来"，跳过引导页
      const skipParams = ['token', 'code', 'inviteCode', 'channelInviteCode', 'inviterId', 'skipGuide', 'state']
      for (const p of skipParams) {
        if (searchParams.get(p) || hashParams.get(p)) {
          shouldSkipGuide = true
          break
        }
      }
    }
    // #endif

    if (!shouldSkipGuide) {
      uni.reLaunch({ url: '/pages/guide/guide' })
      return
    }

    // 3. 获取认证配置（运行时决定登录方式）
    let authConfig
    try {
      authConfig = await fetchAuthConfig()
      uni.setStorageSync('authConfig', JSON.stringify(authConfig))
      console.log('[App] 认证配置:', authConfig.mode, authConfig.methods)
    } catch (e) {
      console.warn('[App] 获取认证配置失败:', e)
      authConfig = { mode: 'local', methods: ['password'] }
    }

    // 应用租户品牌
    if (authConfig.siteName) {
      // H5 端设置页面标题
      // #ifdef H5
      document.title = authConfig.siteName
      // #endif
      // 小程序端设置导航栏标题
      // #ifndef H5
      uni.setNavigationBarTitle({ title: authConfig.siteName })
      // #endif
    }
    // H5 端设置 favicon
    // #ifdef H5
    if (authConfig.favicon) {
      const link = document.querySelector("link[rel~='icon']") || document.createElement('link')
      link.rel = 'icon'
      link.href = authConfig.favicon
      document.head.appendChild(link)
    }
    // #endif

    // 应用主题
    if (authConfig.theme) {
      applyTheme(authConfig.theme)
    }

    // #ifdef MP-WEIXIN
    // 微信小程序：third 模式自动静默登录
    if (authConfig.mode === 'third' && authConfig.wechatMiniProgramEnabled) {
      // 从 storage 读取邀请码（由 handleInviteLink 写入）
      const inviteCode = uni.getStorageSync('inviteCode') || undefined
      const channelInviteCode = uni.getStorageSync('channelInviteCode') || undefined

      // 标记自动登录尝试
      uni.setStorageSync('autoLoginAttempted', 'true')

      silentLogin(inviteCode, channelInviteCode).then(async (result) => {
        console.log('[App] 微信静默登录成功')
        uni.setStorageSync('autoLoginSuccess', 'true')

        if (result.requireAuth && result.isNewUser) {
          await checkAndAuthorize(true)
        }
      }).catch(err => {
        console.warn('[App] 微信静默登录失败:', err)
        uni.setStorageSync('autoLoginSuccess', 'false')
      })
    }
    // #endif

    // #ifdef H5
    // H5 微信浏览器：自动登录 + JS-SDK 初始化
    if (isWechatBrowser() && authConfig.mode === 'third' && authConfig.wechatOfficialAccountEnabled) {
      const token = uni.getStorageSync('token')
      if (token) {
        // 已有 token：初始化 JS-SDK + 默认分享
        initJSSDK().then(() => configShareWithInvite())
      } else {
        // 无 token：自动触发 snsapi_base 静默登录
        // 防循环 4 重检查：URL 不带 code + 不在 auth-callback 页 + 5 分钟 TTL 内未尝试过
        const urlParams = new URLSearchParams(window.location.search)
        const hashQuery = window.location.hash.split('?')[1] || ''
        const hashParams = new URLSearchParams(hashQuery)
        const hasCode = urlParams.get('code') || hashParams.get('code')

        const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/pages/index/index'
        const onAuthCallback = currentPath.startsWith('/pages/auth-callback/auth-callback')

        const attemptedAt = Number(uni.getStorageSync('h5AutoLoginAttemptedAt') || 0)
        const expired = Date.now() - attemptedAt > 5 * 60 * 1000

        if (!hasCode && !onAuthCallback && expired) {
          uni.setStorageSync('h5AutoLoginAttemptedAt', String(Date.now()))
          // state 编码当前路径，授权后回到来源页
          const state = encodeURIComponent(currentPath)
          redirectToWechatAuth('snsapi_base', state).catch(err => {
            console.warn('[App] H5 微信自动授权跳转失败:', err)
          })
        }
      }
    }
    // #endif
  },
  onShow: function() {
    console.log('App Show')

    // 处理邀请链接参数（每次显示都检查）
    handleInviteLink()

    // 每次从后台切回来都检查登录状态
    const path = getCurrentPagePath()

    // 排除首页和登录页，这些页面不需要登录也能访问
    if (isAuthPage(path) && !validateLogin()) {
      redirectToLogin()
    }

    // #ifdef H5
    // H5 微信环境：每次切回刷新分享配置
    if (typeof wx !== 'undefined' && isWechatBrowser()) {
      configShareWithInvite()
    }
    // #endif
  },
  onHide: function() {
    console.log('App Hide')
  },

  // 微信小程序分享配置
  // #ifdef MP-WEIXIN
  onShareAppMessage: function() {
    const user = getUser()
    const authConfig = getStoredAuthConfig()
    const inviteCode = user?.inviteCode ?? ''

    return {
      title: authConfig?.shareTitle ?? '学习课程，答题赢积分',
      path: `/pages/index/index?inviteCode=${inviteCode}&inviterId=${user?.id ?? ''}`,
      imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
    }
  },

  onShareTimeline: function() {
    const user = getUser()
    const authConfig = getStoredAuthConfig()
    const inviteCode = user?.inviteCode ?? ''

    return {
      title: authConfig?.shareTitle ?? '学习课程，答题赢积分',
      query: `inviteCode=${inviteCode}`,
      imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
    }
  }
  // #endif
}
</script>

<style>
/* 每个页面公共css */
:root {
  --brand-primary: #667eea;
  --brand-secondary: #f0f2f5;
  --brand-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
page {
  background-color: var(--brand-secondary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
