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
import { ref, computed } from 'vue'
import { register } from '../../services/api'
import { setLoginState } from '../../utils/storage'
import { getStoredAuthConfig } from '../../services/auth-config'

const siteConfig = getStoredAuthConfig()

const showPassword = ref(false)

const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  inviteCode: uni.getStorageSync('inviteCode') || ''
})

const canRegister = computed(() => {
  return registerForm.value.username.length >= 2 &&
         registerForm.value.email.includes('@') &&
         registerForm.value.password.length >= 6 &&
         registerForm.value.password === registerForm.value.confirmPassword
})

function goToLogin() {
  uni.navigateBack()
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
    const res = await register({
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: registerForm.value.password,
      inviteCode: registerForm.value.inviteCode ?? undefined,
      channelInviteCode: uni.getStorageSync('channelInviteCode') || undefined
    })
    
    const resData = res as any
    
    if (resData.jwt ?? resData.token) {
      setLoginState({
        token: resData.jwt ?? resData.token,
        user: resData.user
      })
      
      uni.removeStorageSync('channelInviteCode')
      
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