<template>
  <view class="login-container">
    <!-- 邀请码提示 -->
    <view v-if="showInviteCodeTip && (inviteCode || channelInviteCode)" class="invite-code-tip">
      <view class="tip-icon">🎁</view>
      <view class="tip-content">
        <text class="tip-title">邀请码已识别</text>
        <text class="tip-text">
          {{ channelInviteCode ? '将自动加入渠道' : '将绑定邀请关系' }}
        </text>
      </view>
    </view>

    <view class="login-header">
      <view class="logo-area">
        <image v-if="authConfig?.logo" :src="authConfig.logo" class="logo-icon" />
        <view v-else class="logo-icon">🎓</view>
        <text class="app-name">{{ authConfig?.siteName ?? '圣麟教育' }}</text>
      </view>
      <text class="app-slogan">{{ authConfig?.siteDescription ?? '让学习更有价值' }}</text>
    </view>

    <!-- third 模式 + 微信小程序环境：自动登录中 -->
    <view v-if="authMode === 'third' && isWechat && !isH5Wechat" class="login-form">
      <view class="form-title">
        <text>{{ autoLoginDone ? '登录成功' : '正在自动登录...' }}</text>
      </view>
      <view v-if="!autoLoginDone" class="auto-login-status">
        <view class="loading-spinner"></view>
        <text class="status-text">微信静默登录中，请稍候</text>
      </view>
      <view v-else class="auto-login-status">
        <text class="status-text success-text">✓ 登录成功，正在跳转...</text>
      </view>
      <!-- 降级入口：自动登录失败时显示 -->
      <view v-if="autoLoginFailed" class="fallback-login">
        <view class="fallback-tip">
          <text>自动登录失败，请使用账号密码登录</text>
        </view>
        <view class="login-tabs">
          <view :class="['tab-item', { active: loginType === 'password' }]" @click="loginType = 'password'">
            <text>账号密码</text>
          </view>
        </view>
        <view v-if="loginType === 'password'">
          <view class="form-item">
            <view class="form-label"><text>账号/邮箱</text></view>
            <input class="form-input" v-model="loginForm.username" type="text" placeholder="请输入账号或邮箱" />
          </view>
          <view class="form-item">
            <view class="form-label"><text>密码</text></view>
            <input class="form-input" v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
          </view>
        </view>
        <view :class="['login-btn', { disabled: !canLogin }]" @click="handleLogin">
          <text>登录</text>
        </view>
      </view>
    </view>

    <!-- third 模式 + H5 微信浏览器环境：选择登录方式 -->
    <view v-else-if="authMode === 'third' && isH5Wechat" class="login-form">
      <view class="form-title">
        <text>微信快捷登录</text>
      </view>
      <view class="h5-wechat-desc">
        <text>检测到微信浏览器，可选择登录方式</text>
      </view>
      <!-- 快速登录（静默，snsapi_base） -->
      <view class="h5-wechat-btn primary" @click="h5WechatQuickLogin">
        <text>快速登录</text>
      </view>
      <view class="h5-wechat-hint">
        <text>无需授权，一键登录</text>
      </view>
      <!-- 完善资料登录（snsapi_userinfo） -->
      <view class="h5-wechat-btn secondary" @click="h5WechatFullLogin">
        <text>完善资料登录</text>
      </view>
      <view class="h5-wechat-hint">
        <text>授权获取微信昵称和头像</text>
      </view>
      <!-- 降级密码登录 -->
      <view class="fallback-login">
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或使用账号密码登录</text>
          <view class="divider-line"></view>
        </view>
        <view class="login-tabs">
          <view :class="['tab-item', { active: loginType === 'password' }]" @click="loginType = 'password'">
            <text>账号密码</text>
          </view>
        </view>
        <view v-if="loginType === 'password'">
          <view class="form-item">
            <view class="form-label"><text>账号/邮箱</text></view>
            <input class="form-input" v-model="loginForm.username" type="text" placeholder="请输入账号或邮箱" />
          </view>
          <view class="form-item">
            <view class="form-label"><text>密码</text></view>
            <input class="form-input" v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
          </view>
        </view>
        <view :class="['login-btn', { disabled: !canLogin }]" @click="handleLogin">
          <text>登录</text>
        </view>
      </view>
    </view>

    <!-- sso 模式：SSO 登录 -->
    <view v-else-if="authMode === 'sso'" class="login-form">
      <view class="form-title">
        <text>SSO 单点登录</text>
      </view>
      <view class="sso-login-info">
        <text class="sso-desc">本系统使用统一身份认证登录</text>
      </view>
      <view class="login-btn" @click="redirectToSso">
        <text>前往 SSO 登录</text>
      </view>
      <!-- 降级：密码登录 -->
      <view class="fallback-section">
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或使用账号密码登录</text>
          <view class="divider-line"></view>
        </view>
        <view class="form-item">
          <view class="form-label"><text>账号/邮箱</text></view>
          <input class="form-input" v-model="loginForm.username" type="text" placeholder="请输入账号或邮箱" />
        </view>
        <view class="form-item">
          <view class="form-label"><text>密码</text></view>
          <input class="form-input" v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
        </view>
        <view :class="['login-btn', { disabled: !canLogin }]" @click="handleLogin">
          <text>登录</text>
        </view>
      </view>
    </view>

    <!-- local 模式 / third+非微信降级：标准登录表单 -->
    <view v-else class="login-form">
      <view class="form-title">
        <text>欢迎登录</text>
      </view>

      <!-- third 模式 + 非微信环境提示 -->
      <view v-if="authMode === 'third' && !isWechat" class="env-tip">
        <text>建议在微信小程序中打开以获得最佳体验</text>
      </view>

      <!-- 登录方式切换 -->
      <view class="login-tabs">
        <view 
          :class="['tab-item', { active: loginType === 'sms' }]"
          @click="loginType = 'sms'"
        >
          <text>手机验证码</text>
        </view>
        <view 
          :class="['tab-item', { active: loginType === 'password' }]"
          @click="loginType = 'password'"
        >
          <text>账号密码</text>
        </view>
      </view>

      <!-- 手机验证码登录 -->
      <view v-if="loginType === 'sms'">
        <view class="form-item">
          <view class="form-label">
            <text>手机号</text>
          </view>
          <input 
            class="form-input" 
            v-model="loginForm.phone" 
            type="number" 
            placeholder="请输入手机号"
            maxlength="11"
          />
        </view>

        <view class="form-item">
          <view class="form-label">
            <text>验证码</text>
          </view>
          <view class="code-input-wrap">
            <input 
              class="form-input code-input" 
              v-model="loginForm.code" 
              type="number" 
              placeholder="请输入验证码"
              maxlength="6"
            />
            <view 
              :class="['code-btn', { disabled: counting }]"
              @click="sendCode"
            >
              <text>{{ counting ? `${countdown}s` : '获取验证码' }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 账号密码登录 -->
      <view v-if="loginType === 'password'">
        <view class="form-item">
          <view class="form-label">
            <text>账号/邮箱</text>
          </view>
          <input 
            class="form-input" 
            v-model="loginForm.username" 
            type="text" 
            placeholder="请输入账号或邮箱"
          />
        </view>

        <view class="form-item">
          <view class="form-label">
            <text>密码</text>
          </view>
          <view class="password-input-wrap">
            <input 
              class="form-input password-input" 
              v-model="loginForm.password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="请输入密码"
            />
            <view class="toggle-password" @click="showPassword = !showPassword">
              <text>{{ showPassword ? '👁️' : '👁️‍🗨️' }}</text>
            </view>
          </view>
        </view>

      </view>

      <view class="agreement">
        <view class="checkbox" @click="agreeTerms = !agreeTerms">
          <view :class="['checkbox-inner', { checked: agreeTerms }]">
            <text v-if="agreeTerms">✓</text>
          </view>
        </view>
        <text class="agreement-text">
          我已阅读并同意<text class="link" @click.stop="showTerms">《用户协议》</text>和<text class="link" @click.stop="showPrivacy">《隐私政策》</text>
        </text>
      </view>

      <view 
        :class="['login-btn', { disabled: !canLogin }]"
        @click="handleLogin"
      >
        <text>登录</text>
      </view>

      <view class="guest-entry" @click="enterAsGuest">
        <text class="guest-text">游客体验</text>
      </view>

      <view v-if="registerEnabled" class="register-link" @click="goToRegister">
        <text>没有账号？<text class="link">立即注册</text></text>
      </view>

      <view v-if="registerEnabled && loginType === 'sms'" class="tips">
        <text class="tip-text">短信登录未注册用户将自动注册并登录</text>
      </view>
    </view>

    <!-- PC 扫码登录（third 模式 + 非微信 H5 环境 + 开放平台已配置） -->
    <view v-if="authMode === 'third' && isH5 && !isH5Wechat && openPlatformEnabled" class="login-form" style="margin-top: 30rpx;">
      <view class="form-title">
        <text>微信扫码登录</text>
      </view>
      <!-- 内嵌二维码模式 -->
      <view v-if="qrconnectUrl" class="qrconnect-container">
        <iframe :src="qrconnectUrl" class="qrconnect-iframe" frameborder="0" scrolling="no"></iframe>
      </view>
      <view v-else class="qrconnect-loading">
        <view class="loading-spinner"></view>
        <text class="status-text">加载二维码中...</text>
      </view>
      <!-- 跳转扫码备选 -->
      <view class="qrconnect-actions">
        <view class="h5-wechat-btn secondary" @click="redirectToOpenPlatformAuth">
          <text>跳转微信扫码</text>
        </view>
      </view>
      <!-- 降级密码登录 -->
      <view class="fallback-login">
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或使用账号密码登录</text>
          <view class="divider-line"></view>
        </view>
        <view class="login-tabs">
          <view :class="['tab-item', { active: loginType === 'password' }]" @click="loginType = 'password'">
            <text>用账号密码登录</text>
          </view>
        </view>
        <view v-if="loginType === 'password'">
          <view class="form-item">
            <view class="form-label"><text>账号/邮箱</text></view>
            <input class="form-input" v-model="loginForm.username" type="text" placeholder="请输入账号或邮箱" />
          </view>
          <view class="form-item">
            <view class="form-label"><text>密码</text></view>
            <input class="form-input" v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
          </view>
        </view>
        <view :class="['login-btn', { disabled: !canLogin }]" @click="handleLogin">
          <text>登录</text>
        </view>
      </view>
    </view>

    <!-- 底部其他登录方式（仅 local 模式 或 third+非微信 显示） -->
    <view v-if="authMode !== 'sso' && !isH5Wechat" class="login-footer">
      <view class="other-login">
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">其他登录方式</text>
          <view class="divider-line"></view>
        </view>
        <view class="login-icons">
          <view class="login-icon-item" @click="wechatLogin">
            <text class="iconfont wechat">微</text>
            <text class="icon-label">微信</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted } from 'vue'
import { login, loginWithPassword, getUserInfo, useInviteCode, joinChannelByInvite, request } from '../../services/api'
import { setToken, setUser, setLoginState } from '../../utils/storage'
import { fetchAuthConfig, getStoredAuthConfig } from '../../services/auth-config'
import type { AuthConfig } from '../../services/auth-config'

// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
import { redirectToWechatAuth } from '../../utils/wx-h5-login'
import { getQrconnectUrl as fetchQrconnectUrl, redirectToOpenPlatformAuth as doRedirectToOpenPlatformAuth } from '../../utils/wx-open-platform-login'
// #endif

// === 认证配置状态 ===
const authConfig = ref<AuthConfig | null>(null)
const authMode = computed(() => authConfig.value?.mode ?? 'local')
const registerEnabled = computed(() => authConfig.value?.registerEnabled !== false)

// 检测运行环境
const isWechat = computed(() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  // #ifdef H5
  return isWechatBrowser()
  // #endif
  // eslint-disable-next-line no-unreachable
  return false
})

// H5 微信浏览器环境标识
const isH5Wechat = computed(() => {
  // #ifdef H5
  return isWechatBrowser()
  // #endif
  // eslint-disable-next-line no-unreachable
  return false
})

// H5 环境标识（用于 PC 扫码登录判断）
const isH5 = computed(() => {
  // #ifdef H5
  return true
  // #endif
  // eslint-disable-next-line no-unreachable
  return false
})

// 开放平台扫码登录状态
const openPlatformEnabled = ref(false)
const qrconnectUrl = ref('')

// 自动登录状态（third + 微信环境）
const autoLoginDone = ref(false)
const autoLoginFailed = ref(false)

// 邀请码状态
const inviteCode = ref('')
const channelInviteCode = ref('')
const showInviteCodeTip = ref(false)

// === 表单状态 ===
const loginType = ref<'sms' | 'password'>('sms')
const showPassword = ref(false)

const loginForm = ref({
  phone: '',
  code: '',
  username: '',
  password: ''
})

const agreeTerms = ref(true)
const counting = ref(false)
const countdown = ref(60)
let timer: ReturnType<typeof setInterval> | null = null

const canLogin = computed(() => {
  if (loginType.value === 'sms') {
    return loginForm.value.phone.length === 11 &&
           loginForm.value.code.length >= 4 &&
           agreeTerms.value
  } else {
    return loginForm.value.username.length > 0 &&
           loginForm.value.password.length >= 6 &&
           agreeTerms.value
  }
})

// === 初始化：获取认证配置 + 邀请码处理 ===
onMounted(async () => {
  // 优先从 storage 读取（App onLaunch 已获取过）
  const stored = getStoredAuthConfig()
  if (stored) {
    authConfig.value = stored
  } else {
    authConfig.value = await fetchAuthConfig()
    uni.setStorageSync('authConfig', JSON.stringify(authConfig.value))
  }

  // 读取邀请码
  inviteCode.value = uni.getStorageSync('inviteCode') ?? ''
  channelInviteCode.value = uni.getStorageSync('channelInviteCode') ?? ''

  if (inviteCode.value || channelInviteCode.value) {
    showInviteCodeTip.value = true
  }

  // third 模式 + 微信小程序环境：检查 App.vue 是否已完成自动登录
  // #ifdef MP-WEIXIN
  if (authConfig.value?.mode === 'third' && authConfig.value?.wechatMiniProgramEnabled) {
    const token = uni.getStorageSync('token')
    const autoLoginAttempted = uni.getStorageSync('autoLoginAttempted')
    const autoLoginSuccess = uni.getStorageSync('autoLoginSuccess')

    // 再次登录：有token，直接跳转
    if (token) {
      console.log('[Login] Token exists, redirect immediately')
      autoLoginDone.value = true
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 100)
      return
    }

    // 首次登录：检查自动登录状态
    if (!autoLoginAttempted) {
      // App.vue还未尝试自动登录，等待
      console.log('[Login] Waiting for auto login...')
      setTimeout(() => {
        const tokenAfterWait = uni.getStorageSync('token')
        if (tokenAfterWait) {
          autoLoginDone.value = true
          setTimeout(() => {
            uni.switchTab({ url: '/pages/index/index' })
          }, 100)
        } else {
          autoLoginFailed.value = true
        }
      }, 3000)
    } else if (autoLoginSuccess === 'true') {
      // 自动登录成功，跳转
      autoLoginDone.value = true
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 100)
    } else {
      // 自动登录失败，显示降级登录
      autoLoginFailed.value = true
    }
  }
  // #endif

  // H5 微信浏览器环境：自动登录（按优先级 SSO → third → local）
  // #ifdef H5
  if (isWechatBrowser()) {
    const token = uni.getStorageSync('token')
    if (token) {
      // 已登录，直接跳转首页
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 500)
      return
    }

    // 未登录，按优先级自动跳转
    const mode = authConfig.value?.mode || 'local'

    // 优先级 1：SSO 模式 → 自动跳 SSO 统一登录
    if (mode === 'sso' && authConfig.value?.ssoLoginUrl) {
      redirectToSso()
      return
    }

    // 优先级 2：third 模式 + 公众号启用 → 自动跳微信静默登录
    if (mode === 'third' && authConfig.value?.wechatOfficialAccountEnabled) {
      // 防循环：URL 带 code 时不跳
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('code')) return

      // 重试次数限制：最多 2 次
      const retryCount = Number(uni.getStorageSync('h5WechatAutoLoginRetries') || 0)
      if (retryCount >= 2) {
        console.log('[Login] 微信自动登录已超过最大重试次数（2次），降级显示登录表单')
        return
      }

      uni.setStorageSync('h5WechatAutoLoginRetries', retryCount + 1)
      redirectToWechatAuth('snsapi_base')
      return
    }

    // 优先级 3：local 模式 → 显示本地登录表单（不做自动跳转）
  }

  // H5 非微信浏览器环境：检查开放平台扫码登录
  if (!isWechatBrowser() && authConfig.value?.mode === 'third' && authConfig.value?.wechatOpenPlatformEnabled) {
    try {
      const configRes = await request('/zhao-third/v1/third/config/wechat/open_platform') as any
      if (configRes?.enabled) {
        openPlatformEnabled.value = true
        // 获取内嵌二维码 URL
        const baseUrl = window.location.origin
        const redirectUrl = `${baseUrl}/#/pages/auth-callback/auth-callback`
        const result = await fetchQrconnectUrl(redirectUrl)
        qrconnectUrl.value = result.qrconnectUrl
      }
    } catch {
      // 开放平台未配置，忽略
    }
  }
  // #endif
})

// === H5 微信登录 ===
function h5WechatQuickLogin() {
  // #ifdef H5
  redirectToWechatAuth('snsapi_base')
  // #endif
}

function h5WechatFullLogin() {
  // #ifdef H5
  redirectToWechatAuth('snsapi_userinfo')
  // #endif
}

// === SSO 登录跳转（携带邀请码参数） ===
function redirectToSso() {
  const ssoUrl = authConfig.value?.ssoLoginUrl
  if (ssoUrl) {
    // #ifdef H5
    // return_url 和 c_end_url 都指向 C 端 auth-callback 页面
    // SSO 认证完成后，login-callback.vue 直接携带 token 跳回 C 端 auth-callback 写入登录态
    const cEndCallback = window.location.origin + '/#/pages/auth-callback/auth-callback'
    const params = new URLSearchParams({
      app_code: authConfig.value?.ssoAppCode || 'course',
      return_url: cEndCallback,
      c_end_url: cEndCallback,
    })
    // 透传邀请码（与 register.vue 保持一致）
    const userInviteCode = uni.getStorageSync('inviteCode') || ''
    const channelInvite = uni.getStorageSync('channelInviteCode') || ''
    if (userInviteCode) params.append('invite_code', userInviteCode)
    if (channelInvite) params.append('channel_code', channelInvite)
    const sep = ssoUrl.includes('?') ? '&' : '?'
    window.location.href = `${ssoUrl}${sep}${params.toString()}`
    // #endif
    // #ifndef H5
    uni.showToast({ title: '请在浏览器中打开 SSO 登录', icon: 'none' })
    // #endif
  } else {
    uni.showToast({ title: 'SSO 登录地址未配置', icon: 'none' })
  }
}

// === 开放平台扫码登录（跳转模式） ===
function redirectToOpenPlatformAuth() {
  // #ifdef H5
  doRedirectToOpenPlatformAuth()
  // #endif
}

// === 发送验证码 ===
function sendCode() {
  if (counting.value) return
  if (loginForm.value.phone.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  
  uni.showToast({ title: '验证码已发送', icon: 'success' })
  counting.value = true
  countdown.value = 60
  
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      counting.value = false
      if (timer) clearInterval(timer)
    }
  }, 1000)
}

// 游客体验入口
function enterAsGuest() {
  uni.showModal({
    title: '游客体验',
    content: '游客模式下您可以浏览课程列表，但无法学习课程、答题或兑换积分。是否继续？',
    success: (res) => {
      if (res.confirm) {
        uni.setStorageSync('isGuest', 'true')
        uni.showToast({ title: '进入游客模式', icon: 'success' })
        setTimeout(() => {
          uni.switchTab({ url: '/pages/index/index' })
        }, 1000)
      }
    }
  })
}

// 跳转注册页
function goToRegister() {
  uni.navigateTo({ url: '/pages/register/register' })
}

// === 主登录处理 ===
async function handleLogin() {
  if (!canLogin.value) {
    if (!agreeTerms.value) {
      uni.showToast({ title: '请先同意用户协议', icon: 'none' })
    }
    return
  }

  uni.showLoading({ title: '登录中...' })

  try {
    let res: any
    let userInfo: any

    if (loginType.value === 'password') {
        res = await loginWithPassword(loginForm.value.username, loginForm.value.password)
      } else {
        res = await login(loginForm.value.phone, loginForm.value.code)
      }

    const resData = res as any

    if (resData.jwt ?? resData.token) {
      const token = resData.jwt ?? resData.token

      let displayName = ''
      if (loginType.value === 'password') {
        displayName = resData.user?.name || resData.user?.username || loginForm.value.username
      } else {
        displayName = '用户' + loginForm.value.phone.slice(-4)
      }

      setLoginState({
        token,
        user: resData.user ?? {
          id: 'user_' + Date.now(),
          name: displayName,
          phone: loginForm.value.phone,
          username: loginForm.value.username
        }
      })

      // 绑定邀请码（用户邀请码和渠道邀请码）
      await bindInviteCodesAfterLogin(resData.user?.id)

      uni.hideLoading()
      uni.showToast({ title: '登录成功', icon: 'success' })

      uni.removeStorageSync('isGuest')

      setTimeout(() => {
        const guideCompleted = uni.getStorageSync('guideCompleted')
        const pages = getCurrentPages()
        const currentPage = pages[pages.length - 1]
        const options = (currentPage as any)?.options || {}
        const redirect = options.redirect

        if (redirect) {
          uni.redirectTo({ url: decodeURIComponent(redirect) })
        } else if (!guideCompleted) {
          uni.redirectTo({ url: '/pages/guide/guide' })
        } else {
          uni.switchTab({ url: '/pages/index/index' })
        }
      }, 1000)
    } else {
      throw new Error('登录失败')
    }
  } catch (e: any) {
    console.error('登录失败', e)
    uni.hideLoading()

    const errorMessage = e.response?.data?.error || e.message || '登录失败'

    if (errorMessage.includes('Invalid identifier') || errorMessage.includes('用户不存在')) {
      uni.showModal({
        title: '用户不存在',
        content: '该账号尚未注册，是否立即注册？',
        confirmText: '去注册',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({ url: '/pages/register/register' })
          }
        }
      })
    } else if (errorMessage.includes('Invalid identifier or password') || errorMessage.includes('密码错误')) {
      uni.showModal({
        title: '密码错误',
        content: '输入的密码不正确，是否忘记密码？',
        confirmText: '忘记密码',
        cancelText: '重新输入',
        success: (res) => {
          if (res.confirm) {
            uni.navigateTo({ url: '/pages/forgot-password/forgot-password' })
          }
        }
      })
    } else if (errorMessage.includes('账户已被锁定')) {
      uni.showToast({ title: '账户已被锁定，请联系管理员', icon: 'none' })
    } else {
      uni.showToast({ title: errorMessage || '登录失败，请重试', icon: 'none' })
    }
  }
}

// === 绑定邀请码 ===
async function bindInviteCodesAfterLogin(userId: number) {
  // 绑定用户邀请码
  if (inviteCode.value) {
    try {
      await useInviteCode(inviteCode.value)
      console.log('[Login] User invite code bound successfully:', inviteCode.value)
      uni.removeStorageSync('inviteCode')

      uni.showToast({
        title: '邀请码绑定成功',
        icon: 'success'
      })
    } catch (e) {
      console.error('[Login] Failed to bind user invite code:', e)
      uni.showToast({
        title: '邀请码绑定失败，请稍后重试',
        icon: 'none'
      })
    }
  }

  // 绑定渠道邀请码
  if (channelInviteCode.value) {
    try {
      await joinChannelByInvite(channelInviteCode.value)
      console.log('[Login] Channel invite code bound successfully:', channelInviteCode.value)
      uni.removeStorageSync('channelInviteCode')

      uni.showToast({
        title: '已成功加入渠道',
        icon: 'success'
      })
    } catch (e) {
      console.error('[Login] Failed to join channel:', e)
      uni.showToast({
        title: '渠道邀请失败，请稍后重试',
        icon: 'none'
      })
    }
  }
}

// === 微信登录（非微信环境降级使用） ===
function wechatLogin() {
  // #ifdef MP-WEIXIN
  uni.showLoading({ title: '登录中...' })
  
  // 提前获取邀请码（修复原 bug：变量在声明前使用）
  const storedInviteCode = uni.getStorageSync('inviteCode')
  const storedChannelInviteCode = uni.getStorageSync('channelInviteCode')
  
  uni.login({
    provider: 'weixin',
    success: async (loginRes) => {
      console.log('微信登录成功', loginRes)
      
      try {
        uni.getUserInfo({
          provider: 'weixin',
          success: async (infoRes) => {
            console.log('获取用户信息成功', infoRes)
            
            const res = await request('/zhao-third/v1/third/callback', {
              method: 'POST',
              data: {
                platform: 'wechat',
                appType: 'official_account',
                code: loginRes.code,
                inviteCode: storedInviteCode || undefined,
                channelInviteCode: storedChannelInviteCode || undefined
              }
            })
            
            const resData = res as any
            if (resData.jwt || resData.token) {
              const token = resData.jwt || resData.token
              
              setLoginState({
                token,
                user: {
                  id: resData.user?.id ?? 'wx_' + Date.now(),
                  name: infoRes.userInfo.nickName,
                  avatar: infoRes.userInfo.avatarUrl,
                  openid: resData.user?.openid
                }
              })
              
              if (storedInviteCode) {
                try {
                  await useInviteCode(storedInviteCode)
                  console.log('邀请码绑定成功:', storedInviteCode)
                } catch (e) {
                  console.error('邀请码绑定失败:', e)
                }
                uni.removeStorageSync('inviteCode')
              }
              
              if (storedChannelInviteCode) {
                try {
                  await joinChannelByInvite(storedChannelInviteCode)
                  console.log('渠道邀请码绑定成功:', storedChannelInviteCode)
                } catch (e) {
                  console.error('渠道邀请码绑定失败:', e)
                }
                uni.removeStorageSync('channelInviteCode')
              }
              
              uni.hideLoading()
              uni.showToast({ title: '登录成功', icon: 'success' })
              
              setTimeout(() => {
                uni.switchTab({ url: '/pages/index/index' })
              }, 1000)
            }
          },
          fail: (err) => {
            console.error('获取用户信息失败', err)
            uni.hideLoading()
            uni.showToast({ title: '获取用户信息失败', icon: 'none' })
          }
        })
      } catch (e) {
        console.error('微信登录失败', e)
        uni.hideLoading()
        uni.showToast({ title: '登录失败', icon: 'none' })
      }
    },
    fail: (err) => {
      console.error('微信登录失败', err)
      uni.hideLoading()
      uni.showToast({ title: '微信登录失败', icon: 'none' })
    }
  })
  // #endif
  
  // #ifdef H5
  if (isWechatBrowser()) {
    redirectToWechatAuth('snsapi_base')
    return
  }
  uni.showToast({ title: '请在微信中打开', icon: 'none' })
  // #endif

  // #ifndef MP-WEIXIN || H5
  uni.showToast({ title: '请在微信小程序中使用此功能', icon: 'none' })
  // #endif
}

function showTerms() {
  uni.showModal({
    title: '用户协议',
    content: '这里是用户协议内容...',
    showCancel: false
  })
}

function showPrivacy() {
  uni.showModal({
    title: '隐私政策',
    content: '这里是隐私政策内容...',
    showCancel: false
  })
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
<style lang="scss" scoped>
.invite-code-tip {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 20rpx 30rpx;
  margin: 20rpx 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.tip-icon {
  font-size: 48rpx;
}

.tip-content {
  flex: 1;
}

.tip-title {
  font-size: 28rpx;
  color: #fff;
  font-weight: bold;
}

.tip-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.login-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  padding: 100rpx 40rpx 40rpx;
}
.login-header { text-align: center; margin-bottom: 80rpx; }
.logo-area { display: flex; align-items: center; justify-content: center; gap: 20rpx; margin-bottom: 20rpx; }
.logo-icon { font-size: 80rpx; }
.app-name { font-size: 48rpx; font-weight: bold; color: #fff; }
.app-slogan { font-size: 28rpx; color: rgba(255, 255, 255, 0.8); }
.login-form { background: #fff; border-radius: 24rpx; padding: 50rpx 40rpx; box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.1); }
.form-title { text-align: center; margin-bottom: 40rpx; }
.form-title text { font-size: 40rpx; font-weight: bold; color: #333; }
.auto-login-status { display: flex; flex-direction: column; align-items: center; padding: 40rpx 0; }
.loading-spinner { width: 60rpx; height: 60rpx; border: 6rpx solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20rpx; }
@keyframes spin { to { transform: rotate(360deg); } }
.status-text { font-size: 28rpx; color: #999; }
.success-text { color: #07c160; font-weight: bold; }
.fallback-login { margin-top: 30rpx; }
.fallback-tip { text-align: center; margin-bottom: 20rpx; }
.fallback-tip text { font-size: 24rpx; color: #999; }
.sso-login-info { text-align: center; padding: 30rpx 0; }
.sso-desc { font-size: 28rpx; color: #666; }
.fallback-section { margin-top: 40rpx; }
.env-tip { background: #fff3e0; border-radius: 12rpx; padding: 20rpx; margin-bottom: 30rpx; text-align: center; }
.env-tip text { font-size: 24rpx; color: #e65100; }
.login-tabs { display: flex; background: #f5f5f5; border-radius: 16rpx; padding: 8rpx; margin-bottom: 40rpx; }
.tab-item { flex: 1; height: 70rpx; display: flex; align-items: center; justify-content: center; border-radius: 12rpx; transition: all 0.3s; }
.tab-item text { font-size: 28rpx; color: #666; }
.tab-item.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.tab-item.active text { color: #fff; font-weight: bold; }
.form-item { margin-bottom: 30rpx; }
.password-input-wrap { display: flex; align-items: center; position: relative; }
.password-input { flex: 1; }
.toggle-password { width: 80rpx; height: 90rpx; display: flex; align-items: center; justify-content: center; font-size: 40rpx; position: absolute; right: 0; top: 0; cursor: pointer; }
.form-label { margin-bottom: 15rpx; }
.form-label text { font-size: 28rpx; color: #666; }
.form-input { width: 100%; height: 90rpx; padding: 0 30rpx; background: #f5f5f5; border-radius: 16rpx; font-size: 30rpx; color: #333; }
.code-input-wrap { display: flex; gap: 20rpx; }
.code-input { flex: 1; }
.code-btn { width: 220rpx; height: 90rpx; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16rpx; flex-shrink: 0; }
.code-btn text { font-size: 26rpx; color: #fff; }
.code-btn.disabled { background: #ccc; }
.agreement { display: flex; align-items: flex-start; gap: 15rpx; margin: 30rpx 0; }
.checkbox { padding: 5rpx; }
.checkbox-inner { width: 36rpx; height: 36rpx; border: 2rpx solid #ddd; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; transition: all 0.3s; }
.checkbox-inner.checked { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-color: #667eea; }
.checkbox-inner text { font-size: 22rpx; color: #fff; }
.agreement-text { font-size: 24rpx; color: #999; line-height: 1.5; flex: 1; }
.link { color: #667eea; }
.login-btn { width: 100%; height: 96rpx; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 48rpx; margin-top: 20rpx; }
.login-btn text { font-size: 32rpx; font-weight: bold; color: #fff; }
.login-btn.disabled { background: #ccc; }
.guest-entry { width: 100%; height: 80rpx; display: flex; align-items: center; justify-content: center; background: transparent; border: 2rpx solid rgba(255, 255, 255, 0.5); border-radius: 40rpx; margin-top: 20rpx; }
.guest-text { font-size: 28rpx; color: rgba(255, 255, 255, 0.8); }
.register-link { text-align: center; margin-top: 30rpx; }
.register-link text { font-size: 26rpx; color: #999; }
.register-link .link { color: #667eea; font-weight: bold; }
.tips { text-align: center; margin-top: 30rpx; }
.tip-text { font-size: 24rpx; color: #999; }
.login-footer { margin-top: 60rpx; }
.other-login { text-align: center; }
.divider { display: flex; align-items: center; margin-bottom: 40rpx; }
.divider-line { flex: 1; height: 1rpx; background: rgba(255, 255, 255, 0.3); }
.divider-text { font-size: 24rpx; color: rgba(255, 255, 255, 0.7); padding: 0 20rpx; }
.login-icons { display: flex; justify-content: center; gap: 80rpx; }
.login-icon-item { display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.iconfont { width: 100rpx; height: 100rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36rpx; color: #fff; }
.iconfont.wechat { background: #07c160; }
.icon-label { font-size: 24rpx; color: rgba(255, 255, 255, 0.8); }
/* H5 微信环境样式 */
.h5-wechat-desc { text-align: center; margin-bottom: 40rpx; }
.h5-wechat-desc text { font-size: 26rpx; color: #666; }
.h5-wechat-btn { width: 100%; height: 96rpx; display: flex; align-items: center; justify-content: center; border-radius: 48rpx; margin-top: 20rpx; }
.h5-wechat-btn text { font-size: 32rpx; font-weight: bold; }
.h5-wechat-btn.primary { background: #07c160; }
.h5-wechat-btn.primary text { color: #fff; }
.h5-wechat-btn.secondary { background: #fff; border: 2rpx solid #07c160; }
.h5-wechat-btn.secondary text { color: #07c160; }
.h5-wechat-hint { text-align: center; margin-top: 10rpx; margin-bottom: 10rpx; }
.h5-wechat-hint text { font-size: 22rpx; color: #999; }
/* PC 扫码登录样式 */
.qrconnect-container { display: flex; justify-content: center; margin: 30rpx 0; }
.qrconnect-iframe { width: 300px; height: 400px; border: none; }
.qrconnect-loading { display: flex; flex-direction: column; align-items: center; padding: 40rpx 0; }
.qrconnect-actions { margin-top: 20rpx; }
</style>
