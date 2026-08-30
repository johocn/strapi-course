<template>
  <view class="sg-overlay" v-if="visible" @click="close">
    <view class="sg-modal" @click.stop>
      <text class="sg-title">分享活动得积分</text>
      <text class="sg-desc">每分享 1 次得 5 积分，每日最多 4 次，两次间隔 30 分钟</text>

      <view class="sg-channel" v-for="c in channels" :key="c.key">
        <view class="sg-phone">
          <view class="sg-topbar"><view class="sg-dots"><view v-for="i in 3" :key="i" class="sg-dot"></view></view></view>
          <view class="sg-arrow">{{ c.arrowText }}</view>
        </view>
        <text class="sg-channel-name">{{ c.name }}</text>
      </view>

      <view class="sg-actions">
        <view class="sg-btn cancel" @click="close">取消</view>
        <view class="sg-btn submit" @click="claim"><text>我已分享 · 领 5 积分</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { claimActivityShare } from '../../services/api'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'claimed'): void }>()
const claiming = ref(false)

const channels = [
  { key: 'friend', name: '分享给好友', arrowText: '点右上角 ⋮ → 分享给好友' },
  { key: 'timeline', name: '分享到朋友圈', arrowText: '点右上角 ⋮ → 分享到朋友圈' },
]

function close() { emit('update:visible', false) }

async function claim() {
  if (claiming.value) return
  claiming.value = true
  try {
    await claimActivityShare()
    emit('claimed')
    close()
    uni.showToast({ title: '+5 积分已到账', icon: 'none' })
  } catch (e: any) {
    const msg = (e as any)?.response?.data?.error || (e as any)?.message || '领取失败'
    uni.showToast({ title: msg, icon: 'none', duration: 2000 })
  } finally {
    claiming.value = false
  }
}
</script>

<style lang="scss" scoped>
.sg-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 999; display: flex; align-items: flex-end; }
.sg-modal { width: 100%; background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 36rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); }
.sg-title { font-size: 34rpx; font-weight: bold; color: #333; display: block; text-align: center; }
.sg-desc { font-size: 24rpx; color: #999; display: block; text-align: center; margin: 12rpx 0 28rpx; line-height: 1.6; }
.sg-channel { display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 20rpx; background: #f7f7f7; border-radius: 16rpx; margin-bottom: 16rpx; }
.sg-phone { width: 160rpx; height: 200rpx; background: #fff; border-radius: 16rpx; border: 2rpx solid #e0e0e0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 20rpx; }
.sg-topbar { display: flex; justify-content: flex-end; width: 100%; padding-right: 18rpx; }
.sg-dots { display: flex; gap: 6rpx; }
.sg-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #999; }
.sg-arrow { font-size: 18rpx; color: #667eea; background: #eef0ff; padding: 6rpx 12rpx; border-radius: 30rpx; margin-top: 20rpx; text-align: center; }
.sg-channel-name { font-size: 28rpx; color: #333; font-weight: 500; }
.sg-actions { display: flex; gap: 20rpx; margin-top: 28rpx; }
.sg-btn { flex: 1; text-align: center; padding: 24rpx; border-radius: 44rpx; font-size: 30rpx; }
.sg-btn.cancel { background: #f0f0f0; color: #666; }
.sg-btn.submit { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; }
</style>