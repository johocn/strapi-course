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
import { shouldUseSso, buildSsoRedirectUrl } from './utils/login-chain'

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

    // 2. 引导页判断
    //    - 默认跳过引导页，避免打断扫码注册/登录/分享等带目的的访问
    //    - 引导页只能从 "我的" 页面主动调用（uni.navigateTo 不走 onLaunch，不受此拦截）

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
    // H5 微信浏览器：自动登录（按优先级 SSO → third → local）
    console.log('[App][debug] isWechatBrowser=', isWechatBrowser(), 'mode=', authConfig.mode, 'officialAccountEnabled=', authConfig.wechatOfficialAccountEnabled)
    if (isWechatBrowser()) {
      const token = uni.getStorageSync('token')
      console.log('[App][debug] 进入微信自动登录分支, token=', token ? 'exists' : 'none')

      // 防循环检查通用条件
      const urlParams = new URLSearchParams(window.location.search)
      const hashQuery = window.location.hash.split('?')[1] || ''
      const hashParams = new URLSearchParams(hashQuery)
      const hasCode = urlParams.get('code') || hashParams.get('code')

      const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/pages/index/index'
      const onAuthCallback = currentPath.startsWith('/pages/auth-callback/auth-callback')
      // 注册页/登录页：用户已主动进入登录注册流程，不自动跳（由页面自身 onMounted 处理）
      const onAuthPage = currentPath.startsWith('/pages/register/register') || currentPath.startsWith('/pages/login/login')

      // 已登录：初始化 JS-SDK + 默认分享
      if (token) {
        initJSSDK().then(() => configShareWithInvite())
        return
      }

      // 未登录，按优先级自动跳转
      const mode = authConfig.mode || 'local'

      // 优先级 1：SSO（ssoEnabled 且 ssoLoginUrl 已配置）→ 自动跳 SSO 统一登录
      // 在 App.vue 直接跳转，避免用户看到页面闪烁后再跳
      // 关键排除页面：auth-callback（SSO 回调用，自己保存 token）、login/register（用户主动进入登录流程）
      // 否则 SSO 302 回跳 auth-callback?token=xxx 触发整页刷新再次 onLaunch 时，
      // token 尚未写入 storage，会再次被轰回 SSO，导致"换微信登录后反复登录、回不到 v.joho.cn"死循环
      if (!hasCode && !onAuthCallback && !onAuthPage && shouldUseSso(authConfig)) {
        const ssoUrl = buildSsoRedirectUrl(authConfig)
        if (ssoUrl) {
          console.log('[App][debug] 微信分支 SSO 自动跳转', ssoUrl)
          window.location.href = ssoUrl
          return
        }
      }

      // 优先级 2：third 模式 + 公众号启用 → 微信静默登录
      if (mode === 'third' && authConfig.wechatOfficialAccountEnabled) {
        if (token) {
          initJSSDK().then(() => configShareWithInvite())
        } else {
          // 重试次数限制：最多 2 次
          const retryCount = Number(uni.getStorageSync('h5WechatAutoLoginRetries') || 0)
          const maxRetriesReached = retryCount >= 2

          console.log('[App][debug] hasCode=', hasCode, 'onAuthCallback=', onAuthCallback, 'onAuthPage=', onAuthPage, 'retryCount=', retryCount, 'maxRetriesReached=', maxRetriesReached)

          if (!hasCode && !onAuthCallback && !onAuthPage && !maxRetriesReached) {
            uni.setStorageSync('h5WechatAutoLoginRetries', retryCount + 1)
            // state 编码当前路径，授权后回到来源页
            const state = encodeURIComponent(currentPath)
            console.log('[App][debug] 准备跳转微信授权 (第' + (retryCount + 1) + '次), state=', state)
            redirectToWechatAuth('snsapi_base', state).then(() => {
              console.log('[App][debug] redirectToWechatAuth 成功，等待跳转')
            }).catch(err => {
              console.warn('[App] H5 微信自动授权跳转失败:', err)
            })
          } else {
            console.log('[App][debug] 跳转条件不满足，跳过自动跳转')
          }
        }
      } else {
        console.log('[App][debug] 非 third 模式，跳过微信自动跳转')
      }
    } else {
      // 非微信环境：如果 SSO 模式，也自动跳转（PC 浏览器场景）
      // 关键排除页面：auth-callback（SSO 回调用，自己保存 token）、login/register（用户主动进入登录流程）
      const existingToken = uni.getStorageSync('token')
      const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/pages/index/index'
      const isCallbackPage = currentPath.startsWith('/pages/auth-callback/auth-callback')
      const isAuthPage = currentPath.startsWith('/pages/login/login') || currentPath.startsWith('/pages/register/register')
      console.log('[App][debug] 非微信环境 SSO 检查, token=', existingToken ? 'exists' : 'none', 'path=', currentPath, 'isCallback=', isCallbackPage)
      // 已登录、或在回调页/登录注册页时，不自动跳 SSO
      if (!existingToken && !isCallbackPage && !isAuthPage && shouldUseSso(authConfig)) {
        const ssoUrl = buildSsoRedirectUrl(authConfig)
        if (ssoUrl) {
          window.location.href = ssoUrl
          return
        }
      }
      console.log('[App][debug] 非微信环境，已登录/回调页/登录页/非SSO，跳过自动登录')
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
