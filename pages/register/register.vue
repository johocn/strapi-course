<template>
  <view class="register-container">
    <view class="register-header">
      <view class="logo-area">
        <view class="logo-icon">🎓</view>
        <text class="app-name">{{ siteConfig?.siteName ?? '学习平台' }}</text>
      </view>
      <text class="app-slogan">让学习更有价值</text>
    </view>

    <view class="register-form">
      <view class="form-title">
        <text>注册账号</text>
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>用户名</text>
          <text class="required">*</text>
        </view>
        <input 
          class="form-input" 
          v-model="registerForm.username" 
          type="text" 
          placeholder="请输入用户名"
          maxlength="20"
        />
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>邮箱</text>
          <text class="required">*</text>
        </view>
        <input 
          class="form-input" 
          v-model="registerForm.email" 
          type="email" 
          placeholder="请输入邮箱"
        />
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>密码</text>
          <text class="required">*</text>
        </view>
        <view class="password-input-wrap">
          <input 
            class="form-input password-input" 
            v-model="registerForm.password" 
            :type="showPassword ? 'text' : 'password'" 
            placeholder="请输入密码（至少6位）"
          />
          <view class="toggle-password" @click="showPassword = !showPassword">
            <text>{{ showPassword ? '👁️' : '👁️‍🗨️' }}</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>确认密码</text>
          <text class="required">*</text>
        </view>
        <input 
          class="form-input" 
          v-model="registerForm.confirmPassword" 
          type="password" 
          placeholder="请再次输入密码"
        />
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>邀请码</text>
          <text class="optional">（可选）</text>
        </view>
        <input 
          class="form-input" 
          v-model="registerForm.inviteCode" 
          type="text" 
          placeholder="请输入邀请码（选填）"
          maxlength="16"
        />
        <view class="invite-hint">
          <text>填写邀请码可获得额外积分奖励</text>
        </view>
      </view>

      <view 
        :class="['register-btn', { disabled: !canRegister }]"
        @click="handleRegister"
      >
        <text>注册</text>
      </view>

      <view class="login-link" @click="goToLogin">
        <text>已有账号？立即登录</text>
      </view>

      <view class="tips">
        <text class="tip-text">注册即表示同意《用户协议》和《隐私政策》</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { register } from '../../services/api'
import { setLoginState } from '../../utils/storage'
import { getStoredAuthConfig, fetchAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
import { redirectToWechatAuth } from '../../utils/wx-h5-login'
import { shouldUseSso, buildSsoRedirectUrl } from '../../utils/login-chain'
// #endif

const siteConfig = getStoredAuthConfig()

const showPassword = ref(false)

const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  inviteCode: uni.getStorageSync('inviteCode') || uni.getStorageSync('channelInviteCode') || ''
})

// 扫码进入时从 URL hash 读取渠道邀请码
// SSO 模式下直接跳转 SSO 登录页，携带 invite_code 和 app_code 参数，减少中间手动环节
onMounted(async () => {
  const hashQuery = window.location.hash.split('?')[1] || ''
  const hashParams = new URLSearchParams(hashQuery)
  const invitecode = hashParams.get('invitecode')
  if (invitecode) {
    uni.setStorageSync('channelInviteCode', invitecode)
    // 如果表单还未设置邀请码，填充到表单
    if (!registerForm.value.inviteCode) {
      registerForm.value.inviteCode = invitecode
    }
  }

  // #ifdef H5
  // 获取认证配置
  let authConfig = getStoredAuthConfig()
  if (!authConfig) {
    try {
      authConfig = await fetchAuthConfig()
      if (authConfig) uni.setStorageSync('authConfig', JSON.stringify(authConfig))
    } catch (e) {
      console.warn('[Register] 获取认证配置失败:', e)
    }
  }

  // 已登录：直接跳首页（邀请码已在 storage，由 auth-callback 的 bindInviteCodesAfterLogin 处理）
  const token = uni.getStorageSync('token')
  if (token) {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }

  // SSO（ssoEnabled 且 ssoLoginUrl 已配置，优先级最高）：跳 SSO 登录，由 SSO 端处理注册
  if (shouldUseSso(authConfig)) {
    // SSO 模式下，若租户关闭了注册，跳登录页让 SSO 端处理（SSO 端可能有注册开关或邀请码注册）
    if (authConfig.registerEnabled === false) {
      uni.redirectTo({ url: '/pages/login/login' })
      return
    }
    const ssoUrl = buildSsoRedirectUrl(authConfig)
    if (ssoUrl) {
      // 透传调试参数 debugWx，便于本地端到端模拟微信环境
      const debugWx = hashParams.get('debugWx')
      const sep = ssoUrl.includes('?') ? '&' : '?'
      window.location.href = `${ssoUrl}${sep}${debugWx === '1' ? 'debugWx=1' : ''}`
      return
    }
  }

  // third 模式 + 微信环境 + 公众号启用：自动跳微信静默登录
  // 场景：用户在微信内点开邀请码注册链接，应自动静默登录，登录后回到注册页继续
  if (isWechatBrowser() && authConfig?.mode === 'third' && authConfig?.wechatOfficialAccountEnabled) {
    // 防循环：URL 带 code 时不跳（由 auth-callback 处理）
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('code') || hashParams.get('code')) return

    // 重试次数限制：最多 2 次自动登录尝试，超过则降级显示注册表单
    const retryCount = Number(uni.getStorageSync('h5WechatAutoLoginRetries') || 0)
    if (retryCount >= 2) {
      console.log('[Register] 微信自动登录已超过最大重试次数（2次），降级显示注册表单')
      return
    }

    uni.setStorageSync('h5WechatAutoLoginRetries', retryCount + 1)
    try {
      // state 透传当前注册页路径（带邀请码），登录后 auth-callback 回到此页
      // 回到此页时已登录，上面的 token 检测会跳首页
      const currentPath = '/pages/register/register' + (invitecode ? `?invitecode=${invitecode}` : '')
      const state = encodeURIComponent(currentPath)
      await redirectToWechatAuth('snsapi_base', state)
    } catch (e) {
      console.warn('[Register] 跳转微信授权失败，显示注册表单:', e)
    }
    return
  }
  // #endif
})

onShow(() => {
  // H5 微信环境：配置分享（标题用"注册"，其余租户兜底）
  // #ifdef H5
  setupPageShare({ title: '注册' })
  // #endif
})

const canRegister = computed(() => {
  return registerForm.value.username.length >= 2 &&
         registerForm.value.email.includes('@') &&
         registerForm.value.password.length >= 6 &&
         registerForm.value.password === registerForm.value.confirmPassword
})

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}

async function handleRegister() {
  if (!canRegister.value) {
    if (registerForm.value.password !== registerForm.value.confirmPassword) {
      uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
    }
    return
  }
  
  uni.showLoading({ title: '注册中...' })
  
  try {
    // 判断邀请码来源，避免重复发送
    const storedInviteCode = uni.getStorageSync('inviteCode') || ''
    const storedChannelInviteCode = uni.getStorageSync('channelInviteCode') || ''
    const formInviteCode = registerForm.value.inviteCode || ''

    // 渠道码始终从 storage 取（不依赖表单）
    const channelInviteCode = storedChannelInviteCode || undefined
    // 如果表单值与渠道码相同，说明是渠道码自动填充，不作为用户邀请码发送
    const isFormValueFromChannel = !!storedChannelInviteCode && formInviteCode === storedChannelInviteCode
    const inviteCode = isFormValueFromChannel
      ? (storedInviteCode || undefined)
      : (formInviteCode || storedInviteCode || undefined)

    const res = await register({
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: registerForm.value.password,
      inviteCode,
      channelInviteCode
    })
    
    const resData = res as any
    
    if (resData.jwt ?? resData.token) {
      setLoginState({
        token: resData.jwt ?? resData.token,
        user: resData.user
      })
      
      uni.removeStorageSync('channelInviteCode')
      uni.removeStorageSync('inviteCode')
      
      uni.hideLoading()
      uni.showToast({ title: '注册成功', icon: 'success' })
      
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 1000)
    } else {
      throw new Error('注册失败')
    }
  } catch (e: any) {
    console.error('注册失败', e)
    uni.hideLoading()
    uni.showToast({ 
      title: e.response?.data?.error || e.message || '注册失败，请重试', 
      icon: 'none',
      duration: 2000
    })
  }
}
</script>

<style lang="scss" scoped>
.register-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 30rpx;
  box-sizing: border-box;
}

.register-header {
  text-align: center;
  padding: 60rpx 0 40rpx;
}

.logo-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.logo-icon {
  font-size: 64rpx;
}

.app-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.app-slogan {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.register-form {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.1);
}

.form-title {
  text-align: center;
  margin-bottom: 40rpx;
  
  text {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }
}

.form-item {
  margin-bottom: 30rpx;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 16rpx;
  
  text {
    font-size: 28rpx;
    color: #666;
  }
  
  .required {
    color: #ff4d4f;
  }
  
  .optional {
    color: #999;
    font-size: 24rpx;
  }
}

.form-input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  transition: border-color 0.3s;
  
  &:focus {
    border-color: #667eea;
  }
}

.password-input-wrap {
  position: relative;
}

.password-input {
  padding-right: 100rpx;
}

.toggle-password {
  position: absolute;
  right: 24rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 32rpx;
}

.invite-hint {
  margin-top: 12rpx;
  
  text {
    font-size: 22rpx;
    color: #999;
  }
}

.register-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  transition: all 0.3s;
  
  text {
    font-size: 32rpx;
    font-weight: bold;
    color: #fff;
  }
  
  &.disabled {
    background: #ccc;
    opacity: 0.6;
  }
}

.login-link {
  text-align: center;
  margin-top: 30rpx;
  
  text {
    font-size: 26rpx;
    color: #667eea;
  }
}

.tips {
  text-align: center;
  margin-top: 40rpx;
  
  .tip-text {
    font-size: 22rpx;
    color: #999;
    line-height: 1.5;
  }
}
</style>