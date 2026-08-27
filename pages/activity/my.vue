<template>
  <view class="page-container">
    <view v-if="learningSummary.length" class="learn-summary">
      <text class="learn-summary-title">已解锁学习内容</text>
      <view v-for="ls in learningSummary" :key="ls.activityId" class="learn-summary-item" @click="goLearn(ls)">
        <text class="learn-summary-name">{{ ls.title }}</text>
        <text class="learn-summary-count">{{ ls.count }} 项</text>
        <text class="learn-summary-arrow">›</text>
      </view>
    </view>
    <view class="record-list">
      <view
        v-for="item in records"
        :key="item.documentId || item.id"
        class="record-item"
        @click="goDetail(item)"
      >
        <view class="item-top">
          <text class="item-title">{{ item.activity?.title ?? '活动' }}</text>
          <view class="record-status">
            <text>{{ signStatusText(item) }}</text>
          </view>
        </view>
        <text class="item-time">{{ formatTime(item.activity?.startTime) }} ~ {{ formatTime(item.activity?.endTime) }}</text>
        <view class="item-venue">
          <text class="venue-icon">📍</text>
          <text class="venue-name">{{ item.activity?.venueName || '待定场地' }}</text>
        </view>
        <view v-if="formFieldList(item).length" class="item-form" @click.stop="toggleForm(item)">
          <text class="form-toggle">{{ expandedId === keyOf(item) ? '收起报名信息' : '查看报名信息' }}</text>
          <view v-if="expandedId === keyOf(item)" class="form-fields">
            <view v-for="fd in formFieldList(item)" :key="fd.key" class="ff-row">
              <text class="ff-label">{{ fd.label }}</text>
              <text class="ff-value">{{ fd.value }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="records.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">🎪</text>
      <text class="empty-text">暂无报名记录</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { myActivities, getMyActivityLearning } from '../../services/api'
import { getToken } from '../../utils/storage'
import { setupPageShare } from '../../utils/share'

const records = ref<any[]>([])
const loading = ref(false)

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function signStatusText(item: any): string {
  if (item.status === 'waiting') return '候补中'
  const att = item.attendance
  if (att?.checkedIn) return '已签到'
  return '已报名'
}

function goDetail(item: any) {
  const actId = item.activity?.documentId || item.activity?.id
  if (!actId) return
  uni.navigateTo({ url: `/pages/activity/detail?id=${actId}` })
}

const expandedId = ref('')

function keyOf(item: any) {
  return item.documentId || item.id || ''
}

function formFieldList(item: any) {
  const cfg = Array.isArray(item.activity?.formConfig) ? item.activity.formConfig : []
  const fd = item.formData && typeof item.formData === 'object' ? item.formData : {}
  return cfg.filter((f: any) => f?.key && fd[f.key] !== undefined && fd[f.key] !== null && fd[f.key] !== '')
    .map((f: any) => ({
      key: f.key,
      label: f.label || f.key,
      value: Array.isArray(fd[f.key]) ? fd[f.key].join('、') : String(fd[f.key]),
    }))
}

function toggleForm(item: any) {
  const k = keyOf(item)
  expandedId.value = expandedId.value === k ? '' : k
}

async function loadRecords() {
  // 未登录时交由 request 内部自动跳登录，这里直接请求即可
  loading.value = true
  try {
    const res = await myActivities()
    const list = (res as any)?.data ?? res
    records.value = Array.isArray(list) ? list : []
    await loadLearningSummary(list)
  } catch (e) {
    console.error('加载我的活动失败', e)
  } finally {
    loading.value = false
  }
}

/** 汇总已报名活动的已解锁学习内容（仅已签到/已结束的报名记录） */
const learningSummary = ref<any[]>([])

async function loadLearningSummary(list: any[]) {
  try {
    const eligible = (Array.isArray(list) ? list : []).filter(
      (r: any) => r?.attendance?.checkedIn || r?.activity?.status === 'ended'
    )
    const items: any[] = []
    for (const r of eligible.slice(0, 5)) {
      const actId = r.activity?.documentId || r.activity?.id
      if (!actId) continue
      const payload = await getMyActivityLearning(actId)
      if (!payload) continue
      const total = (payload.articles?.length || 0) + (payload.lessons?.length || 0) + (payload.courses?.length || 0)
      if (total > 0) {
        items.push({ activityId: actId, title: r.activity?.title, count: total })
      }
    }
    learningSummary.value = items
  } catch (e) {
    console.warn('加载学习内容汇总失败', e)
  }
}

function goLearn(ls: any) {
  uni.navigateTo({ url: `/pages/activity/detail?id=${ls.activityId}` })
}

onMounted(() => {
  loadRecords()
  setupPageShare({ title: '我的活动' })
})

onShow(() => {
  if (getToken()) loadRecords()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.record-item {
  background: #fff;
  padding: 28rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.item-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.record-status {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: #f6ffed;
  color: #52c41a;
  white-space: nowrap;
}

.item-time {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 16rpx;
}

.item-venue {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
}

.venue-icon {
  font-size: 26rpx;
  margin-right: 8rpx;
}

.venue-name {
  font-size: 24rpx;
  color: #666;
}

.item-form { margin-top: 16rpx; border-top: 1rpx solid #f0f0f0; padding-top: 12rpx; }
.form-toggle { font-size: 24rpx; color: #667eea; }
.form-fields { margin-top: 12rpx; }
.ff-row { display: flex; justify-content: space-between; gap: 20rpx; padding: 8rpx 0; font-size: 26rpx; }
.ff-label { color: #999; flex-shrink: 0; }
.ff-value { color: #333; text-align: right; word-break: break-all; }

.empty-state {
  padding: 120rpx 30rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}

.loading-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}

.learn-summary { background: #fff; border-radius: 16rpx; padding: 24rpx 28rpx; margin-bottom: 20rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05); }
.learn-summary-title { display: block; font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 12rpx; }
.learn-summary-item { display: flex; align-items: center; padding: 16rpx 0; border-top: 1rpx solid #f5f5f5; }
.learn-summary-name { flex: 1; font-size: 26rpx; color: #333; }
.learn-summary-count { font-size: 24rpx; color: #667eea; margin-right: 10rpx; }
.learn-summary-arrow { color: #ccc; font-size: 26rpx; }
</style>