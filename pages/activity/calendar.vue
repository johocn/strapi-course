<template>
  <view class="cal-page">
    <view class="cal-header">
      <view class="cal-nav" @click="changeMonth(-1)">‹</view>
      <view class="cal-title">{{ year }}年{{ month }}月</view>
      <view class="cal-nav" @click="changeMonth(1)">›</view>
    </view>

    <view class="cal-week">
      <view v-for="(w, i) in weekNames" :key="i" class="cal-week-cell">{{ w }}</view>
    </view>

    <view class="cal-grid">
      <view
        v-for="(cell, i) in grid"
        :key="i"
        :class="['cal-cell', {
          'is-dim': !cell.inMonth,
          'is-active': cell.inMonth && cell.isActive && !cell.isSelected,
          'is-selected': cell.isSelected,
        }]"
        @click="cell.inMonth && selectDay(cell.dateStr)"
      >
        <text class="cal-day">{{ cell.dayNumber }}</text>
        <view v-if="cell.isActive" class="cal-dot"></view>
      </view>
    </view>

    <view class="day-section">
      <view class="day-title">{{ dayLabel }}</view>
      <view v-if="selectedActivities.length" class="activity-list">
        <view
          v-for="item in selectedActivities"
          :key="item.documentId || item.id"
          class="activity-item"
          @click="goDetail(item)"
        >
          <view class="item-top">
            <text class="item-title">{{ item.title }}</text>
            <text :class="['status-tag', `status-${item.status}`]">{{ statusText(item.status) }}</text>
          </view>
          <view class="item-time">
            <text class="time-value">{{ formatTime(item.startTime) }} ~ {{ formatTime(item.endTime) }}</text>
          </view>
          <view class="item-venue">
            <text class="venue-icon">📍</text>
            <text class="venue-name">{{ item.venueName || '待定场地' }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="!loading" class="empty-day">当天暂未开放活动</view>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getActivityCalendar } from '../../services/api'

const weekNames = ['一', '二', '三', '四', '五', '六', '日']
const year = ref<number>(new Date().getFullYear())
const month = ref<number>(new Date().getMonth() + 1)
const selectedDate = ref<string>('')
const activeDays = ref<Map<string, any[]>>(new Map())
const loading = ref(false)

const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())
const firstOffset = computed(() => (new Date(year.value, month.value - 1, 1).getDay() + 6) % 7)

const grid = computed(() => {
  const cells: any[] = []
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - firstOffset.value + 1
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth.value
    const dateStr = inMonth
      ? `${year.value}-${String(month.value).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
      : ''
    cells.push({ dateStr, dayNumber: inMonth ? dayNumber : '', inMonth, isActive: inMonth && activeDays.value.has(dateStr), isSelected: dateStr === selectedDate.value })
  }
  return cells
})

const dayLabel = computed(() => {
  if (!selectedDate.value) return ''
  const d = new Date(`${selectedDate.value}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekNames[(d.getDay() + 6) % 7]}`
})
const selectedActivities = computed(() => activeDays.value.get(selectedDate.value) || [])

function statusText(status: string): string {
  return ({ draft: '未开放', signup_open: '报名中', ongoing: '进行中', ended: '已结束' } as Record<string, string>)[status] ?? status ?? ''
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function goDetail(item: any) {
  const id = item.documentId || item.id
  uni.navigateTo({ url: `/pages/activity/detail?id=${id}` })
}

function ym(): string {
  return `${year.value}-${String(month.value).padStart(2, '0')}`
}

function selectDay(dateStr: string) { selectedDate.value = dateStr }

async function loadMonth() {
  loading.value = true
  try {
    const res: any = await getActivityCalendar(ym())
    const days = res?.data?.days ?? []
    const map = new Map<string, any[]>()
    for (const day of days) map.set(day.date, day.activities || [])
    activeDays.value = map
    if (!map.has(selectedDate.value)) {
      selectedDate.value = days.length ? days[0].date : ''
    }
  } catch (e) {
    console.error('加载活动日历失败', e)
  } finally {
    loading.value = false
  }
}

function changeMonth(delta: number) {
  month.value += delta
  if (month.value > 12) { month.value = 1; year.value++ }
  if (month.value < 1) { month.value = 12; year.value-- }
  selectedDate.value = ''
  loadMonth()
}

onLoad(() => {
  const now = new Date()
  selectedDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  loadMonth()
})
</script>

<style lang="scss" scoped>
.cal-page { min-height: 100vh; background: #f5f5f5; padding: 20rpx 30rpx 40rpx; }
.cal-header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 16rpx; padding: 20rpx 24rpx; }
.cal-nav { font-size: 44rpx; color: #666; padding: 0 30rpx; }
.cal-title { font-size: 32rpx; font-weight: 600; color: #333; }
.cal-week { display: flex; background: #fff; border-top: 1rpx solid #f0f0f0; }
.cal-week-cell { flex: 1; text-align: center; font-size: 24rpx; color: #999; padding: 16rpx 0; }
.cal-grid { display: flex; flex-wrap: wrap; background: #fff; border-top: 1rpx solid #f0f0f0; padding-bottom: 10rpx; }
.cal-cell { width: 14.28%; height: 88rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
.cal-day { font-size: 28rpx; color: #333; }
.is-dim .cal-day { color: #ccc; }
.is-active .cal-day { color: #667eea; font-weight: 600; }
.is-selected .cal-day { color: #fff; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 56rpx; height: 56rpx; text-align: center; line-height: 56rpx; border-radius: 50%; }
.cal-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #ff7875; position: absolute; bottom: 10rpx; }
.is-selected .cal-dot { bottom: 2rpx; }
.day-section { margin-top: 20rpx; }
.day-title { font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 16rpx; }
.activity-list { display: flex; flex-direction: column; gap: 16rpx; }
.activity-item { background: #fff; padding: 24rpx; border-radius: 16rpx; }
.item-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.item-title { flex: 1; font-size: 30rpx; font-weight: 600; color: #333; margin-right: 12rpx; }
.status-tag { flex-shrink: 0; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 20rpx; }
.status-signup_open { background: #e6f7ff; color: #1890ff; }
.status-ongoing { background: #f6ffed; color: #52c41a; }
.status-ended { background: #f5f5f5; color: #999; }
.status-draft { background: #f0f0f0; color: #bbb; }
.item-time { margin-bottom: 8rpx; }
.time-value { font-size: 26rpx; color: #666; }
.item-venue { display: flex; align-items: center; }
.venue-icon { font-size: 24rpx; margin-right: 8rpx; }
.venue-name { font-size: 26rpx; color: #666; }
.empty-day { background: #fff; border-radius: 16rpx; padding: 60rpx 0; text-align: center; font-size: 26rpx; color: #999; }
.loading-more { text-align: center; padding: 30rpx; font-size: 26rpx; color: #999; }
</style>