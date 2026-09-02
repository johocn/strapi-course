<template>
  <view class="promo-card promo-contact">
    <text class="section-title">联系方式</text>

    <view v-if="contact?.wechat" class="contact-item" @click="emit('open-wechat')">
      <image v-if="wechatQrcode" :src="wechatQrcode" mode="aspectFill" class="contact-icon contact-icon--img" />
      <text v-else class="contact-icon">💬</text>
      <view class="contact-body">
        <text class="contact-label">微信</text>
        <text class="contact-value">点击查看二维码</text>
      </view>
      <text class="contact-arrow">›</text>
    </view>

    <view v-if="contact?.phone" class="contact-item" @click="emit('call-phone')">
      <text class="contact-icon">📞</text>
      <view class="contact-body">
        <text class="contact-label">电话</text>
        <text class="contact-value">点击拨打电话</text>
      </view>
      <text class="contact-arrow">›</text>
    </view>

    <view v-if="contact?.card" class="contact-item" @click="emit('open-card')">
      <image v-if="cardAvatar" :src="cardAvatar" mode="aspectFill" class="contact-icon contact-icon--img" />
      <text v-else class="contact-icon">🪪</text>
      <view class="contact-body">
        <text class="contact-label">名片</text>
        <text class="contact-value">{{ cardName }}</text>
        <text v-if="cardSub" class="contact-sub">{{ cardSub }}</text>
      </view>
      <text class="contact-arrow">›</text>
    </view>

    <text v-if="contact?.notice" class="contact-notice">{{ contact.notice }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveMediaUrl } from '../../utils/env'

const props = defineProps<{
  activity?: any
  config?: any
  contact?: {
    wechat?: { qrcode?: any; id?: string }
    phone?: string
    card?: { name?: string; title?: string; company?: string; phone?: string; wechat?: string; avatar?: any }
    notice?: string
  }
}>()

const emit = defineEmits<{
  (e: 'open-wechat'): void
  (e: 'call-phone'): void
  (e: 'open-card'): void
  (e: 'open-message'): void
}>()

const wechatQrcode = computed(() => resolveMediaUrl(props.contact?.wechat?.qrcode))
const cardAvatar = computed(() => resolveMediaUrl(props.contact?.card?.avatar))

const cardName = computed(() => {
  const c = props.contact?.card
  if (!c?.name) return ''
  return c.title ? `${c.name} · ${c.title}` : c.name
})

const cardSub = computed(() => {
  const c = props.contact?.card
  const parts = [c?.company, c?.phone, c?.wechat ? `微信：${c.wechat}` : ''].filter(Boolean)
  return parts.join(' · ')
})
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 12rpx;
}

.contact-item {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
}

.contact-icon {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  margin-right: 16rpx;
  border-radius: 12rpx;
  background: var(--c-primary);
  opacity: 0.9;
  font-size: 36rpx;
  line-height: 72rpx;
  text-align: center;
}

.contact-icon--img {
  opacity: 1;
}

.contact-body {
  flex: 1;
}

.contact-label {
  display: block;
  font-size: 24rpx;
  color: var(--c-text-dim);
  margin-bottom: 2rpx;
}

.contact-value {
  display: block;
  font-size: 28rpx;
  color: var(--c-text);
}

.contact-sub {
  display: block;
  margin-top: 2rpx;
  font-size: 24rpx;
  color: var(--c-text-dim);
}

.contact-arrow {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 32rpx;
  color: var(--c-text-dim);
}

.contact-notice {
  display: block;
  margin-top: 12rpx;
  padding: 16rpx;
  font-size: 24rpx;
  color: var(--c-text-dim);
  border-radius: 12rpx;
  background: var(--c-card);
  line-height: 1.6;
}

.contact-actions {
  margin-top: 20rpx;
}

.contact-btn {
  padding: 20rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
  text-align: center;
}
</style>
