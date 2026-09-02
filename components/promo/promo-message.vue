<template>
  <view class="promo-card promo-message">
    <view class="message-entry">
      <text class="message-title">{{ config?.title || '留言咨询' }}</text>
      <view class="promo-btn-primary message-btn" @click="emit('open-message')">{{ config?.btnText || '去留言' }}</view>
    </view>

    <view v-if="messages.length" class="message-list">
      <view v-for="(m, index) in messages" :key="m.id ?? index" class="message-item">
        <view class="msg-title-row">
          <text class="msg-no">#{{ index + 1 }}</text>
          <text class="msg-q">问</text>
          <text class="msg-user">{{ m.nickname || '游客' }}</text>
          <text class="msg-time">{{ formatTime(m.createdAt) }}</text>
        </view>
        <text class="msg-content">{{ m.content }}</text>
        <view v-if="m.status === 'replied' && m.reply" class="msg-reply-box">
          <view class="msg-title-row">
            <text class="msg-no">&nbsp;</text>
            <text class="msg-a">答</text>
            <text class="msg-user msg-user--admin">管理员</text>
            <text class="msg-time">{{ formatTime(m.repliedAt || m.createdAt) }}</text>
          </view>
          <text class="msg-reply">{{ m.reply }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PromoMessage {
  id?: number | string
  content?: string
  reply?: string
  status?: string
  nickname?: string
  createdAt?: string
  repliedAt?: string
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
  margin-top: 6rpx;
  font-size: 27rpx;
  color: var(--c-text);
  line-height: 1.6;
}

.msg-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.msg-no {
  font-size: 22rpx;
  color: var(--c-text-dim);
}

.msg-q,
.msg-a {
  flex-shrink: 0;
  min-width: 40rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  text-align: center;
}

.msg-q {
  background: rgba(64, 158, 255, 0.12);
  color: #409eff;
}

.msg-a {
  background: rgba(7, 193, 96, 0.14);
  color: #07c160;
}

.msg-user {
  font-size: 24rpx;
  color: var(--c-text);
  font-weight: 600;
}

.msg-user--admin {
  color: #07c160;
}

.msg-reply-box {
  margin-top: 10rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: var(--c-card);
}

.msg-reply {
  display: block;
  margin-top: 6rpx;
  font-size: 25rpx;
  color: var(--c-primary);
  line-height: 1.6;
}

.msg-time {
  margin-left: auto;
  font-size: 22rpx;
  color: var(--c-text-dim);
}
</style>
