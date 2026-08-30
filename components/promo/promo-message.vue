<template>
  <view class="promo-card promo-message">
    <view class="message-entry">
      <text class="message-title">留言咨询</text>
      <view class="promo-btn-primary message-btn" @click="emit('open-message')">去留言</view>
    </view>

    <view v-if="messages.length" class="message-list">
      <view v-for="(m, index) in messages" :key="index" class="message-item">
        <text class="msg-content">{{ m.content }}</text>
        <view v-if="m.status === 'replied' && m.reply" class="msg-reply-box">
          <text class="msg-reply">{{ m.reply }}</text>
        </view>
        <text class="msg-time">{{ formatTime(m.createdAt) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PromoMessage {
  content?: string
  reply?: string
  status?: string
  createdAt?: string
}

const props = defineProps<{
  activity?: any
  config?: any
  messages?: PromoMessage[]
}>()

const emit = defineEmits<{
  (e: 'open-message'): void
}>()

const messages = computed<PromoMessage[]>(() => props.messages || [])

function formatTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.message-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.message-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
}

.message-btn {
  padding: 14rpx 40rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
}

.message-list {
  margin-top: 20rpx;
}

.message-item {
  padding: 16rpx 0;
  border-bottom: 2rpx solid var(--c-text-dim);

  &:last-child {
    border-bottom: none;
  }
}

.msg-content {
  display: block;
  font-size: 27rpx;
  color: var(--c-text);
  line-height: 1.6;
}

.msg-reply-box {
  margin-top: 10rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: var(--c-card);
}

.msg-reply {
  display: block;
  font-size: 25rpx;
  color: var(--c-primary);
  line-height: 1.6;
}

.msg-time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--c-text-dim);
}
</style>
