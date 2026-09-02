<template>
  <view class="float-contact">
    <!-- 电话 -->
    <view v-if="contact?.phone" class="float-btn float-btn--tel" @click="emit('call-phone')">
      <text class="float-icon">📞</text>
      <text class="float-label">电话</text>
    </view>

    <!-- 微信：微信环境优先公众号客服，否则二维码 -->
    <view v-if="hasWechat" class="float-btn float-btn--wx" @click="onWechat">
      <text class="float-icon">💬</text>
      <text class="float-label">{{ inWechat ? '客服' : '微信' }}</text>
    </view>

    <!-- 留言：默认展示（完全定制页默认加载），带未读回复角标 -->
    <view v-if="showMessage" class="float-btn float-btn--msg" @click="emit('open-message')">
      <text class="float-icon">✉️</text>
      <text class="float-label">留言</text>
      <text v-if="messageBadge" class="float-badge">{{ messageBadge }}</text>
    </view>

    <!-- 公众号客服跳转 -->
    <view v-if="serviceUrl" class="float-cs" @click="openService">
      <text>联系客服</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveMediaUrl } from '../../utils/env'

const props = defineProps<{
  contact?: any
  inWechat?: boolean
  /** 是否展示悬浮「留言」按钮（完全定制页默认加载） */
  showMessage?: boolean
  /** 未读回复数（角标，>0 时显示） */
  messageBadge?: number
}>()

const emit = defineEmits<{
  (e: 'call-phone'): void
  (e: 'open-wechat'): void
  (e: 'open-message'): void
}>()

const inWechat = computed(() => !!props.inWechat)
const wechatQrcode = computed(() => resolveMediaUrl(props.contact?.wechat?.qrcode))
/** 公众号客服链接（可在联系方式的 wechatServiceUrl 或 config 中配置，未配置时微信环境回退二维码） */
const serviceUrl = computed<string>(() =>
  props.contact?.wechatServiceUrl || props.contact?.config?.wechatServiceUrl || ''
)
const hasWechat = computed(() =>
  Boolean(wechatQrcode.value || props.contact?.wechat?.id || serviceUrl.value)
)

function onWechat() {
  if (inWechat.value && serviceUrl.value) {
    // 微信环境 + 已配置公众号客服链接 → 直接跳客服
    openService()
    return
  }
  // 否则展示二维码（微信/浏览器通用）
  emit('open-wechat')
}

function openService() {
  const url = serviceUrl.value
  if (!url) return
  if (inWechat.value && window.__wxjs_environment === 'miniprogram') {
    uni.showToast({ title: '请在浏览中打开客服', icon: 'none' })
    return
  }
  window.location.href = url
}

// note: window.__wxjs_environment 由微信 JSSDK 注入；此处仅声明避免 TS 报错
declare global {
  interface Window { __wxjs_environment?: string }
}
</script>

<style lang="scss" scoped>
.float-contact {
  position: fixed;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.float-btn {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: var(--c-primary);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.18);
}

.float-icon {
  font-size: 36rpx;
  line-height: 1;
}

.float-label {
  font-size: 18rpx;
  margin-top: 4rpx;
}

.float-btn--wx {
  background: #07c160;
}

.float-btn--msg {
  background: var(--c-primary);
}

.float-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 6rpx;
  border-radius: 15rpx;
  background: #ff4d4f;
  color: #fff;
  font-size: 18rpx;
  line-height: 30rpx;
  text-align: center;
}
</style>