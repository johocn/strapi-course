<template>
  <view class="error-state">
    <view class="error-icon">{{ icon }}</view>
    <text class="error-title">{{ title }}</text>
    <text class="error-desc">{{ description }}</text>
    <view v-if="showRetry" class="retry-btn" @click="handleRetry">
      <text>{{ retryText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  icon: { type: String, default: '⚠️' },
  title: { type: String, default: '加载失败' },
  description: { type: String, default: '网络连接异常，请稍后重试' },
  showRetry: { type: Boolean, default: true },
  retryText: { type: String, default: '重新加载' }
})

const emit = defineEmits(['retry'])

function handleRetry() {
  emit('retry')
}
</script>

<style lang="scss" scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
  min-height: 400rpx;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: 30rpx;
}

.error-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.error-desc {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 30rpx;
}

.retry-btn {
  padding: 20rpx 60rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 40rpx;
}

.retry-btn text {
  font-size: 28rpx;
  color: #fff;
}
</style>