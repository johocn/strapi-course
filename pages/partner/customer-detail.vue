<template>
  <view class="page-container">
    <!-- 画像卡片 -->
    <view v-if="profile" class="card">
      <view class="profile-header">
        <view class="segment-badge" :style="{ background: segmentColor(profile.segment), color: '#fff' }">
          {{ profile.segment ?? 'C' }}
        </view>
        <view class="profile-score">
          <text class="score-num">{{ profile.segmentScore ?? 0 }}</text>
          <text class="score-label">综合分</text>
        </view>
      </view>
      <text v-if="profile.segmentReason" class="profile-reason">{{ profile.segmentReason }}</text>

      <view class="dimension-list">
        <view v-for="dim in dimensions" :key="dim.key" class="dimension-item">
          <view class="dimension-top">
            <text class="dimension-name">{{ dim.label }}</text>
            <text class="dimension-value">{{ profile[dim.key] ?? 0 }}</text>
          </view>
          <view class="progress-track">
            <view
              class="progress-fill"
              :style="{ width: `${clamp(profile[dim.key])}%`, background: dim.color }"
            ></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 触达操作 -->
    <view class="card">
      <view class="card-title">客户触达</view>
      <view class="touch-btn" @click="showTouchTemplates">
        <text class="touch-btn-text">发送提醒</text>
      </view>
    </view>

    <!-- 新增跟进 -->
    <view class="card">
      <view class="card-title">新增跟进</view>
      <textarea
        class="follow-input"
        v-model="newContent"
        placeholder="填写跟进内容"
        :maxlength="200"
      />
      <view class="follow-row">
        <view class="status-switch">
          <view
            :class="['status-option', { active: newStatus === 'todo' }]"
            @click="newStatus = 'todo'"
          >
            <text>待跟进</text>
          </view>
          <view
            :class="['status-option', { active: newStatus === 'done' }]"
            @click="newStatus = 'done'"
          >
            <text>已完成</text>
          </view>
        </view>
        <view class="submit-btn" @click="submitFollowUp">
          <text class="submit-btn-text">保存跟进</text>
        </view>
      </view>
    </view>

    <!-- 跟进记录 -->
    <view class="card">
      <view class="card-title">跟进记录</view>
      <view v-if="followUps.length === 0" class="follow-empty">暂无跟进记录</view>
      <view v-for="fu in followUps" :key="fu.id" class="follow-item">
        <view class="follow-top">
          <text :class="['follow-status', { done: fu.status === 'done' }]">
            {{ fu.status === 'done' ? '已完成' : fu.status === 'cancelled' ? '已取消' : '待跟进' }}
          </text>
          <view
            v-if="fu.status !== 'done' && fu.status !== 'cancelled'"
            class="mark-done-btn"
            @click="markDone(fu)"
          >
            <text>标记完成</text>
          </view>
        </view>
        <text class="follow-content">{{ fu.content }}</text>
        <text v-if="fu.nextFollowAt" class="follow-time">下次跟进：{{ formatTime(fu.nextFollowAt) }}</text>
      </view>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { partnerApi } from '../../services/api'
import { getToken } from '../../utils/storage'

const customerId = ref<number | null>(null)
const profile = ref<any>(null)
const followUps = ref<any[]>([])
const loading = ref(false)
const newContent = ref('')
const newStatus = ref<'todo' | 'done'>('todo')

const dimensions = [
  { key: 'activity', label: '活跃度', color: '#667eea' },
  { key: 'reading', label: '阅读深度', color: '#3498db' },
  { key: 'completion', label: '完课率', color: '#27ae60' },
  { key: 'attendance', label: '到场意愿', color: '#e67e22' },
  { key: 'payment', label: '付费潜力', color: '#e74c3c' },
]

const touchTemplates = [
  { code: 'act_confirm', name: '活动报名确认' },
  { code: 'act_before', name: '活动开始前提醒' },
  { code: 'course_d7', name: '课后7天' },
]

function segmentColor(segment?: string): string {
  const map: Record<string, string> = { S: '#e74c3c', A: '#e67e22', B: '#3498db', C: '#95a5a6' }
  return map[segment || 'C'] || '#95a5a6'
}

function clamp(n: any): number {
  const v = Number(n) || 0
  return Math.max(0, Math.min(100, v))
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadDetail() {
  if (customerId.value == null) return
  loading.value = true
  try {
    const res: any = await partnerApi.customerDetail(customerId.value)
    profile.value = res?.data ?? res
  } catch (e) {
    console.error('加载客户画像失败', e)
  } finally {
    loading.value = false
  }
}

async function loadFollowUps() {
  if (customerId.value == null) return
  try {
    const res: any = await partnerApi.listFollowUps()
    const list = res?.data ?? res
    const all = Array.isArray(list) ? list : []
    followUps.value = all.filter((fu: any) => Number(fu.customer) === Number(customerId.value))
  } catch (e) {
    console.error('加载跟进记录失败', e)
  }
}

function showTouchTemplates() {
  uni.showActionSheet({
    itemList: touchTemplates.map(t => t.name),
    success: (res) => {
      const tpl = touchTemplates[res.tapIndex]
      if (tpl) sendTouch(tpl.code)
    },
  })
}

async function sendTouch(templateCode: string) {
  if (customerId.value == null) return
  uni.showLoading({ title: '发送中...' })
  try {
    await partnerApi.touch(customerId.value, { templateCode, params: { name: '客户', time: '' } })
    uni.hideLoading()
    uni.showToast({ title: '提醒已发送', icon: 'success' })
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '发送失败', icon: 'none' })
  }
}

async function submitFollowUp() {
  if (customerId.value == null) return
  if (!newContent.value.trim()) {
    uni.showToast({ title: '请填写跟进内容', icon: 'none' })
    return
  }
  try {
    await partnerApi.createFollowUp({
      customer: customerId.value,
      content: newContent.value.trim(),
      status: newStatus.value,
    })
    newContent.value = ''
    newStatus.value = 'todo'
    uni.showToast({ title: '已保存', icon: 'success' })
    loadFollowUps()
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '保存失败', icon: 'none' })
  }
}

async function markDone(fu: any) {
  try {
    await partnerApi.updateFollowUp(fu.id, { status: 'done' })
    uni.showToast({ title: '已标记完成', icon: 'success' })
    loadFollowUps()
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '操作失败', icon: 'none' })
  }
}

onLoad((query: any) => {
  customerId.value = query?.id ? Number(query.id) : null
  if (customerId.value != null) loadDetail()
})

onShow(() => {
  if (getToken() && customerId.value != null) loadFollowUps()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.segment-badge {
  min-width: 88rpx;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 700;
}

.profile-score {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.score-num {
  font-size: 56rpx;
  font-weight: 700;
  color: #667eea;
}

.score-label {
  font-size: 24rpx;
  color: #999;
}

.profile-reason {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 24rpx;
}

.dimension-list {
  border-top: 1rpx solid #f0f0f0;
  padding-top: 20rpx;
}

.dimension-item {
  margin-bottom: 18rpx;
}

.dimension-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.dimension-name {
  font-size: 24rpx;
  color: #666;
}

.dimension-value {
  font-size: 24rpx;
  color: #333;
  font-weight: 600;
}

.progress-track {
  height: 12rpx;
  background: #f0f0f0;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s;
}

.touch-btn {
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.touch-btn-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}

.follow-input {
  width: 100%;
  min-height: 140rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.follow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  gap: 20rpx;
}

.status-switch {
  display: flex;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 6rpx;
  flex: 1;
}

.status-option {
  flex: 1;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
}

.status-option text {
  font-size: 24rpx;
  color: #666;
}

.status-option.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.status-option.active text {
  color: #fff;
  font-weight: 600;
}

.submit-btn {
  width: 200rpx;
  height: 72rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.submit-btn-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.follow-empty {
  padding: 30rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #999;
}

.follow-item {
  border-bottom: 1rpx solid #f0f0f0;
  padding: 20rpx 0;

  &:last-child {
    border-bottom: none;
  }
}

.follow-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.follow-status {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background: #fff7e6;
  color: #e67e22;

  &.done {
    background: #f6ffed;
    color: #52c41a;
  }
}

.mark-done-btn {
  padding: 6rpx 20rpx;
  border: 1rpx solid #667eea;
  border-radius: 20rpx;
}

.mark-done-btn text {
  font-size: 22rpx;
  color: #667eea;
}

.follow-content {
  display: block;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.follow-time {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.loading-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}
</style>
