<template>
  <view v-if="visible" class="lock-dialog-mask" @click="$emit('update:visible', false)">
    <view class="lock-dialog" @click.stop>
      <text class="lock-icon">{{ enforceMode ? '⚠️' : '💡' }}</text>
      <text class="lock-title">{{ enforceMode ? '顺序学习提示' : '顺序学习建议' }}</text>
      <text class="lock-desc">{{ reason }}</text>
      <view class="lock-actions">
        <!-- 硬锁：只有「去学习」按钮 -->
        <view v-if="enforceMode" class="lock-btn lock-btn-primary" @click="$emit('goto')">
          <text>去学习前置内容</text>
        </view>
        <!-- 软锁：「按顺序学习」+「继续学习」 -->
        <template v-else>
          <view class="lock-btn lock-btn-primary" @click="$emit('goto')">
            <text>按顺序学习</text>
          </view>
          <view class="lock-btn lock-btn-secondary" @click="$emit('skip')">
            <text>继续学习</text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup>defineProps({
  visible: { type: Boolean, default: false },
  enforceMode: { type: Boolean, default: false },
  reason: { type: String, default: '' }
});
defineEmits(['update:visible', 'goto', 'skip']);
</script>

<style lang="scss" scoped>
.lock-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-dialog {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lock-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.lock-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.lock-desc {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  margin-bottom: 30rpx;
  line-height: 1.5;
}

.lock-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.lock-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.lock-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.lock-btn-secondary {
  background: #f5f5f5;
  color: #666;
}
</style>
