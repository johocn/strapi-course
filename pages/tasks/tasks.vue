<template>
  <view class="page-container">
    <view v-for="(group, groupName) in taskGroups" :key="groupName" class="task-section">
      <view class="section-header">
        <text class="section-title">{{ groupLabels[groupName] || groupName }}</text>
        <text class="section-count">{{ getGroupCompleted(group) }}/{{ group.length }}</text>
      </view>
      <view class="task-list">
        <view v-for="task in group" :key="task.action" class="task-card" :class="{ completed: task.isCompleted }">
          <view class="task-info">
            <view class="task-title-row">
              <text v-if="task.icon && isImageUrl(task.icon)" class="task-icon-img-wrap">
                <image class="task-icon-img" :src="task.icon" mode="aspectFit" />
              </text>
              <text v-else-if="task.icon" class="task-icon">{{ task.icon }}</text>
              <text class="task-name">{{ task.name || task.description || task.action }}</text>
            </view>
            <text class="task-desc" v-if="task.name && task.description">{{ task.description }}</text>
            <view class="task-meta">
              <text class="task-points">+{{ task.points }}积分</text>
              <text class="task-limit" v-if="task.limitPerDay > 0">每日{{ task.limitPerDay }}次</text>
              <text class="task-once" v-if="task.isOneTime">一次性</text>
            </view>
          </view>
          <view class="task-status">
            <view class="status-done" v-if="task.isCompleted">已完成</view>
            <view class="status-todo" v-else-if="task.action === 'activity_share' && !task.isCompleted" :class="{ disabled: !shareCanClaim }" @click="openShareGuide(task)">去分享</view>
            <view class="status-progress" v-else-if="task.limitPerDay > 0 && task.todayCount > 0">
              {{ task.todayCount }}/{{ task.limitPerDay }}
            </view>
            <view class="status-todo" v-else>去完成</view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="Object.keys(taskGroups).length === 0" class="empty-state">
      <text>暂无任务</text>
    </view>

    <ShareGuide
      :visible="showShareGuide"
      :link-type="currentShareTask?.linkType"
      :link-target-id="currentShareTask?.linkTargetId"
      :link-title="currentShareTask?.linkTitle"
      @update:visible="v => showShareGuide = v"
      @claimed="onShareClaimed"
      @goto="onShareGoto"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPointTasks } from '../../services/api'
import { setupPageShare } from '../../utils/share'
import ShareGuide from '../../components/share-guide/share-guide.vue'
import { useShareClaim } from '../../utils/use-share-claim'

const taskGroups = ref<Record<string, any[]>>({})
const showShareGuide = ref(false)
const currentShareTask = ref<any>(null)

const { state: shareClaim, refresh: refreshShare } = useShareClaim()
const shareCanClaim = computed(() => shareClaim.value.canClaim)

const groupLabels: Record<string, string> = {
  daily: '每日签到',
  interact: '互动任务',
  learn: '学习任务',
  social: '社交任务',
  onetime: '一次性任务',
  other: '其他任务',
}

function isImageUrl(v: string): boolean {
  return /^https?:\/\//i.test(v)
}

function getGroupCompleted(group: any[]) {
  return group.filter(t => t.isCompleted).length
}

async function loadTasks() {
  try {
    const res = await getPointTasks()
    taskGroups.value = res || {}
  } catch (e) {
    console.error('加载任务失败', e)
  }
}

onMounted(() => {
  loadTasks()
  setupPageShare({ title: '任务中心' })
})

onShow(() => {
  loadTasks()
  refreshShare()
})

function openShareGuide(task: any) {
  if (!shareCanClaim.value) {
    const s = shareClaim.value
    if (s.dailyLimit > 0 && s.dailyCount >= s.dailyLimit) {
      uni.showToast({ title: '今日分享积分次数已达上限', icon: 'none' })
    } else {
      const min = Math.ceil(s.remainingMs / 60000)
      if (min > 0) uni.showToast({ title: `距下次可领取约 ${min} 分钟`, icon: 'none' })
      else uni.showToast({ title: '登录后可领取', icon: 'none' })
    }
    return
  }
  currentShareTask.value = task
  showShareGuide.value = true
}

function onShareClaimed() {
  showShareGuide.value = false
  loadTasks()
}

function onShareGoto(target: { linkType: string; linkTargetId: string }) {
  const { linkType, linkTargetId } = target
  if (!linkTargetId || linkType === 'none') return
  let url = ''
  if (linkType === 'course') url = `/pages/course-detail/course-detail?courseId=${linkTargetId}`
  else if (linkType === 'activity') url = `/pages/activity/detail?id=${linkTargetId}`
  // article 无独立页面，不跳转
  if (url) uni.navigateTo({ url })
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.task-section {
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.section-count {
  font-size: 26rpx;
  color: #999;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.task-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-card.completed {
  opacity: 0.6;
}

.task-info {
  flex: 1;
}

.task-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.task-icon {
  font-size: 34rpx;
  line-height: 1;
}

.task-icon-img-wrap {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.task-icon-img {
  width: 100%;
  height: 100%;
}

.task-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.task-desc {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  display: block;
  margin-bottom: 8rpx;
}

.task-meta {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.task-points {
  font-size: 26rpx;
  color: #667eea;
  font-weight: bold;
}

.task-limit, .task-once {
  font-size: 22rpx;
  color: #999;
  padding: 2rpx 10rpx;
  background: #f5f5f5;
  border-radius: 10rpx;
}

.task-status {
  flex-shrink: 0;
}

.status-done {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  background: #e8f5e9;
  color: #07c160;
}

.status-progress {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  background: #fff3e0;
  color: #ff9800;
}

.status-todo {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  background: #e3f2fd;
  color: #1976d2;
}
.status-todo.disabled {
  background: #eceff1;
  color: #9e9e9e;
}

.empty-state {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
