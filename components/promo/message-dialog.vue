<template>
  <view class="msg-mask" v-if="visible" @click="close">
    <view class="msg-panel" @click.stop>
      <view class="msg-header">
        <text class="msg-title">留言咨询</text>
        <text class="msg-close" @click="close">✕</text>
      </view>
      <scroll-view scroll-y class="msg-list">
        <view v-if="!messages.length" class="msg-empty">暂无留言，写下你的问题吧</view>
        <view v-for="(m, i) in messages" :key="m.id ?? i" class="msg-item">
          <view class="msg-row">
            <text class="msg-no">#{{ i + 1 }}</text>
            <text class="msg-q">问</text>
            <text class="msg-user">{{ m.nickname || '游客' }}</text>
            <text class="msg-time">{{ formatTime(m.createdAt) }}</text>
          </view>
          <text class="msg-content">{{ m.content }}</text>
          <view v-if="m.status === 'replied' && m.reply" class="msg-reply-box">
            <view class="msg-row">
              <text class="msg-no">&nbsp;</text>
              <text class="msg-a">答</text>
              <text class="msg-user msg-user--admin">管理员</text>
              <text class="msg-time">{{ formatTime(m.repliedAt || m.createdAt) }}</text>
            </view>
            <text class="msg-reply">{{ m.reply }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="msg-input-row">
        <input class="msg-input" v-model="input" :placeholder="placeholder" confirm-type="send" @confirm="submit" />
        <button class="msg-send" :disabled="sending || !input.trim()" @click="submit"><text>发送</text></button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  visible: boolean
  messages: any[]
  placeholder?: string
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'submit', content: string): void | Promise<void>
}>()

const input = ref('')
const sending = ref(false)

function formatTime(t?: string): string {
  if (!t) return ''
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function close() { emit('update:visible', false) }
async function submit() {
  const c = input.value.trim()
  if (!c || sending.value) return
  sending.value = true
  try {
    await emit('submit', c)
    input.value = ''
  } finally {
    sending.value = false
  }
}
</script>

<style lang="scss" scoped>
.msg-mask { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.5); display: flex; align-items: flex-end; }
.msg-panel { width: 100%; height: 66vh; background: #fff; border-radius: 24rpx 24rpx 0 0; display: flex; flex-direction: column; }
.msg-header { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; border-bottom: 1rpx solid #f0f0f0; }
.msg-title { font-size: 32rpx; font-weight: bold; }
.msg-close { font-size: 32rpx; color: #999; padding: 0 8rpx; }
.msg-list { flex: 1; padding: 0 32rpx; }
.msg-empty { padding: 80rpx 0; text-align: center; color: #999; font-size: 26rpx; }
.msg-item { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.msg-row { display: flex; align-items: center; gap: 10rpx; }
.msg-no { font-size: 22rpx; color: #999; }
.msg-q, .msg-a { flex-shrink: 0; min-width: 40rpx; padding: 2rpx 10rpx; border-radius: 8rpx; font-size: 22rpx; text-align: center; }
.msg-q { background: rgba(64,158,255,.12); color: #409eff; }
.msg-a { background: rgba(7,193,96,.14); color: #07c160; }
.msg-user { font-size: 24rpx; color: #333; font-weight: 600; }
.msg-user--admin { color: #07c160; }
.msg-time { margin-left: auto; font-size: 22rpx; color: #999; }
.msg-content { display: block; margin-top: 6rpx; font-size: 27rpx; line-height: 1.6; }
.msg-reply-box { margin-top: 10rpx; padding: 12rpx 16rpx; background: #f6f6f6; border-radius: 12rpx; }
.msg-reply { display: block; margin-top: 6rpx; font-size: 25rpx; color: #07c160; line-height: 1.6; }
.msg-input-row { display: flex; align-items: center; gap: 16rpx; padding: 20rpx 32rpx; border-top: 1rpx solid #f0f0f0; background: #fff; }
.msg-input { flex: 1; height: 72rpx; padding: 0 24rpx; background: #f5f6f7; border-radius: 36rpx; font-size: 26rpx; }
.msg-send { min-width: 128rpx; height: 72rpx; line-height: 72rpx; padding: 0 32rpx; background: #07c160; color: #fff; font-size: 28rpx; border-radius: 36rpx; }
.msg-send[disabled] { opacity: .5; }
</style>