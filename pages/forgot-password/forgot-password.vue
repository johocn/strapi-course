<template>
  <view class="forgot-container">
    <view class="forgot-header">
      <view class="logo-area">
        <view class="logo-icon">🎓</view>
        <text class="app-name">{{ siteConfig?.siteName ?? '学习平台' }}</text>
      </view>
      <text class="app-slogan">让学习更有价值</text>
    </view>

    <view class="forgot-form">
      <view class="form-title">
        <text>忘记密码</text>
      </view>

      <view class="form-desc">
        <text>请输入您注册时使用的邮箱，我们将发送密码重置链接到您的邮箱</text>
      </view>

      <view class="form-item">
        <view class="form-label">
          <text>邮箱</text>
          <text class="required">*</text>
        </view>
        <input 
          class="form-input" 
          v-model="email" 
          type="email" 
          placeholder="请输入注册邮箱"
        />
      </view>

      <view 
        :class="['submit-btn', { disabled: !isValidEmail }]"
        @click="handleSubmit"
      >
        <text>发送重置链接</text>
      </view>

      <view class="login-link" @click="goToLogin">
        <text>返回登录</text>
      </view>

      <view class="tips">
        <text class="tip-text">如果未收到邮件，请检查垃圾邮件或稍后重试</text>
      </view>
    </view>

    <!-- 成功弹窗 -->
    <view v-if="showSuccess" class="success-modal">
      <view class="modal-content">
        <view class="success-icon">✓</view>
        <text class="success-title">发送成功</text>
        <text class="success-desc">密码重置链接已发送到您的邮箱</text>
        <view class="modal-btn" @click="goToLogin">
          <text>返回登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { BASE_API } from '../../utils/env'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

const siteConfig = getStoredAuthConfig()

const email = ref('')
const showSuccess = ref(false)
const isLoading = ref(false)

const isValidEmail = computed(() => {
  return email.value.includes('@') && email.value.includes('.')
})

function goToLogin() {
  uni.navigateBack()
}

async function handleSubmit() {
  if (!isValidEmail.value) {
    uni.showToast({ title: '请输入正确的邮箱', icon: 'none' })
    return
  }
  
  isLoading.value = true
  uni.showLoading({ title: '发送中...' })
  
  try {
    // 调用后端忘记密码接口
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: `${BASE_API}/auth/forgot-password`,
        method: 'POST',
        data: { email: email.value },
        success: (res: any) => resolve(res.data),
        fail: (err: any) => reject(err)
      })
    })
    
    console.log('忘记密码请求结果:', res)
    
    uni.hideLoading()
    showSuccess.value = true
  } catch (e) {
    console.error('发送失败', e)
    uni.hideLoading()
    uni.showToast({ title: '发送失败，请稍后重试', icon: 'none' })
  }
}

onShow(() => {
  setupPageShare({ title: '找回密码' })
})
</script>

<style lang="scss" scoped>
.forgot-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 30rpx;
  box-sizing: border-box;
}

.forgot-header {
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

.forgot-form {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.1);
}

.form-title {
  text-align: center;
  margin-bottom: 20rpx;
  
  text {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }
}

.form-desc {
  text-align: center;
  margin-bottom: 40rpx;
  
  text {
    font-size: 26rpx;
    color: #999;
    line-height: 1.5;
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

.submit-btn {
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

.success-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  margin: 40rpx;
  text-align: center;
}

.success-icon {
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 30rpx;
  
  text {
    font-size: 48rpx;
    color: #fff;
    font-weight: bold;
  }
}

.success-title {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.success-desc {
  display: block;
  font-size: 28rpx;
  color: #999;
  margin-bottom: 40rpx;
}

.modal-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  
  text {
    font-size: 30rpx;
    font-weight: bold;
    color: #fff;
  }
}
</style>