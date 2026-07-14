<template>
  <view class="loading-state">
    <view class="loading-spinner">
      <view class="spinner-dot" v-for="i in 3" :key="i"></view>
    </view>
    <text class="loading-text">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

const props = defineProps({
  text: { type: String, default: '加载中...' }
})
</script>

<style lang="scss" scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
  min-height: 400rpx;
}

.loading-spinner {
  display: flex;
  gap: 10rpx;
  margin-bottom: 30rpx;
}

.spinner-dot {
  width: 20rpx;
  height: 20rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.spinner-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.spinner-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.loading-text {
  font-size: 26rpx;
  color: #999;
}
</style>