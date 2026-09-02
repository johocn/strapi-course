<template>
  <view class="sg-overlay" v-if="visible" @click="close">
    <view class="sg-modal" @click.stop>
      <text class="sg-title">分享活动得积分</text>
      <text class="sg-desc">{{ ruleText }}</text>

      <view class="sg-channel" v-for="c in channels" :key="c.key">
        <view class="sg-phone">
          <view class="sg-topbar"><view class="sg-dots"><view v-for="i in 3" :key="i" class="sg-dot"></view></view></view>
          <view class="sg-arrow">{{ c.arrowText }}</view>
        </view>
        <text class="sg-channel-name">{{ c.name }}</text>
      </view>

      <view class="sg-actions">
        <view class="sg-copy" v-if="props.linkType && props.linkType !== 'none' && props.linkTargetId" @click="copyLink">
          <text>📋 复制分享链接</text>
        </view>
      </view>
      <view class="sg-actions">
        <view class="sg-btn cancel" @click="close">取消</view>
        <view class="sg-btn submit" :class="{ disabled: !canClaim }" @click="doClaim">
          <text>{{ canClaim ? '领取分享积分' : '未到领取时间' }}</text>
        </view>
      </view>
      <view v-if="!canClaim && reasonText" class="sg-reason"><text>{{ reasonText }}</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { buildShareLink } from '../../utils/invite'
import { useShareClaim, shareRuleText, shareReasonText } from '../../utils/use-share-claim'

const props = defineProps<{
  visible: boolean
  linkType?: string
  linkTargetId?: string
  linkTitle?: string
  taskId?: string | number
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'claimed'): void
  (e: 'goto', target: { linkType: string; linkTargetId: string }): void
}>()
const claiming = ref(false)

// 任务分享落地：按任务维度（task:{taskId}）核算好友点击/冷却/每日上限；无任务维度时不传
const { state: claim, refresh: refreshClaim, claim: claimShare } =
  useShareClaim(() => (props.taskId != null ? { dimType: 'task', dimId: props.taskId } : undefined))
const canClaim = computed(() => claim.value.canClaim)
const ruleText = computed(() => shareRuleText(claim.value))
const reasonText = computed(() => shareReasonText(claim.value))

const channels = [
  { key: 'friend', name: '分享给好友', arrowText: '点右上角 ⋮ → 分享给好友' },
  { key: 'timeline', name: '分享到朋友圈', arrowText: '点右上角 ⋮ → 分享到朋友圈' },
]

watch(() => props.visible, (v) => { if (v) refreshClaim() })

function close() { emit('update:visible', false) }

function copyLink() {
  let link = buildShareLink(props.linkType, props.linkTargetId)
  if (!link) {
    uni.showToast({ title: '该任务暂无可复制的分享链接', icon: 'none' })
    return
  }
  // 任务分享链接追加 taskId，好友点击落地后归 task 维度核算
  if (props.taskId != null) {
    link += (link.includes('?') ? '&' : '?') + `taskId=${props.taskId}`
  }
  uni.setClipboardData({
    data: link,
    success: () => uni.showToast({ title: '分享链接已复制', icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
  })
}

async function doClaim() {
  if (claiming.value) return
  if (!canClaim.value) {
    if (reasonText.value) uni.showToast({ title: reasonText.value, icon: 'none', duration: 2000 })
    return
  }
  claiming.value = true
  const targetType = props.linkType
  const targetId = props.linkTargetId
  try {
    const r = await claimShare()
    if (r.ok) {
      emit('claimed')
      close()
      uni.showToast({ title: `+${r.points} 积分已到账`, icon: 'none' })
      // 领分成功且有分享目标 → 通知父组件跳转到对应内容页（父组件负责路由跳转）
      if (targetType && targetType !== 'none' && targetId) {
        emit('goto', { linkType: targetType, linkTargetId: targetId })
      }
    } else {
      uni.showToast({ title: r.message, icon: 'none', duration: 2000 })
    }
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
.sg-copy { flex: 1; text-align: center; padding: 24rpx; border-radius: 44rpx; font-size: 30rpx; background: #f0f4ff; color: #667eea; font-weight: 500; }
.sg-btn { flex: 1; text-align: center; padding: 24rpx; border-radius: 44rpx; font-size: 30rpx; }
.sg-btn.cancel { background: #f0f0f0; color: #666; }
.sg-btn.submit { background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; }
.sg-btn.submit.disabled { background: #c9c9c9; }
.sg-reason { margin-top: 20rpx; text-align: center; font-size: 24rpx; color: #e64340; }
</style>