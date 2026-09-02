<template>
  <view class="qr-mask" v-if="visible" @click="close">
    <view class="qr-panel" @click.stop>
      <text class="qr-title">添加客服微信</text>
      <image
        v-if="qrcode"
        :src="qrcode"
        class="qr-image"
        mode="aspectFit"
        show-menu-by-longpress
        @longpress="onLongPressQr"
      />
      <text v-else class="qr-empty">未配置微信二维码</text>

      <text class="qr-tip">{{ tipText }}</text>

      <view v-if="wechatId" class="qr-id-row">
        <text class="qr-id-label">微信号</text>
        <text class="qr-id">{{ wechatId }}</text>
      </view>

      <view v-if="inWechat" class="qr-actions">
        <view class="qr-btn qr-btn--ghost" @click="close"><text>取消</text></view>
      </view>
      <view v-else class="qr-actions">
        <view v-if="wechatId" class="qr-btn qr-btn--primary" @click="copyWechat"><text>复制微信号</text></view>
        <view class="qr-btn qr-btn--ghost" @click="close"><text>关闭</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveMediaUrl } from '../../utils/env'

const props = defineProps<{
  visible: boolean
  qrcode?: any
  wechatId?: string
  inWechat?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const qrcode = computed(() => resolveMediaUrl(props.qrcode))
const wechatId = computed(() => props.wechatId || '')
const inWechat = computed(() => !!props.inWechat)

const tipText = computed(() =>
  inWechat.value ? '长按二维码识别添加客服' : '打开微信扫一扫，扫描二维码添加客服'
)

function close() {
  emit('update:visible', false)
}

/** 只读展示长按提示，触发系统图片菜单（含微信识别二维码） */
function onLongPressQr() {
  /* 依赖 show-menu-by-longpress 系统菜单，无需额外处理 */
}

function copyWechat() {
  if (!wechatId.value) return
  uni.setClipboardData({
    data: wechatId.value,
    success: () => uni.showToast({ title: '微信号已复制，去微信添加好友', icon: 'success' }),
  })
}
</script>

<style lang="scss" scoped>
.qr-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-panel {
  width: 560rpx;
  padding: 40rpx;
  border-radius: 24rpx;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qr-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text, #222);
}

.qr-image {
  width: 360rpx;
  height: 360rpx;
  margin: 28rpx 0 12rpx;
}

.qr-empty {
  margin: 40rpx 0;
  font-size: 26rpx;
  color: var(--c-text-dim, #999);
}

.qr-tip {
  font-size: 24rpx;
  color: var(--c-text-dim, #999);
  text-align: center;
  line-height: 1.6;
}

.qr-id-row {
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.qr-id-label {
  font-size: 24rpx;
  color: var(--c-text-dim, #999);
}

.qr-id {
  font-size: 26rpx;
  color: var(--c-primary, #07c160);
  font-weight: 600;
}

.qr-actions {
  margin-top: 32rpx;
  width: 100%;
  display: flex;
  gap: 20rpx;
}

.qr-btn {
  flex: 1;
  padding: 20rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
  text-align: center;
}

.qr-btn--primary {
  background: var(--c-primary, #07c160);
  color: #fff;
}

.qr-btn--ghost {
  background: #f2f3f5;
  color: #666;
}
</style>