<template>
  <view
    :class="['course-card', `course-card--${mode}`]"
    @click="$emit('click', course.documentId)"
  >
    <!-- 封面区 -->
    <view class="course-cover">
      <image
        v-if="course.cover?.url"
        :src="getImageUrl(course.cover.url)"
        mode="aspectFill"
        class="cover-image"
        lazy-load
      />
      <view v-else class="cover-placeholder">📚</view>

      <!-- 付费/免费/积分标签 -->
      <view class="course-badge">
        <text v-if="displayType === 'free'" class="badge-free">免费</text>
        <text v-else-if="displayType === 'points'" class="badge-points">{{ course.pointsPrice || 0 }}积分</text>
        <text v-else-if="displayType === 'paid'" class="badge-paid">付费</text>
      </view>

      <!-- 积分标签 -->
      <view v-if="course.enablePoints && course.points > 0" class="points-badge">
        <text>+{{ course.points }}积分</text>
      </view>
    </view>

    <!-- 信息区 -->
    <view class="course-info">
      <text class="course-title">{{ course.title }}</text>
      <text v-if="mode === 'list'" class="course-desc">{{ course.description || '暂无课程描述' }}</text>

      <!-- 元信息 -->
      <view class="course-meta">
        <view class="meta-left">
          <text class="meta-item">📖 {{ course.category?.name || '综合' }}</text>
          <text class="meta-item" v-if="course.difficulty">🎯 {{ getDifficultyText(course.difficulty) }}</text>
        </view>
        <text class="meta-item" v-if="course.studentCount">👥 {{ formatCount(course.studentCount) }}</text>
      </view>

      <!-- 操作按钮（仅 list 模式显示） -->
      <view v-if="mode === 'list'" class="course-action">
        <text class="action-btn">
          {{ displayType === 'paid' ? '立即购买' : displayType === 'points' ? '积分兑换' : '开始学习' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getImageUrl } from '../../utils/env'
import type { Course } from '../../services/api'

const props = defineProps<{
  course: Course
  mode: 'grid' | 'list'
}>()

defineEmits<{
  (e: 'click', documentId: string): void
}>()

/** 课程展示类型（软迁移：courseType 为空时按 isFree/isPaid 反推） */
const displayType = computed<'free' | 'points' | 'paid'>(() => {
  if (props.course.courseType) return props.course.courseType
  if (props.course.isPaid) return 'paid'
  return 'free'
})

function getDifficultyText(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
    expert: '专家'
  }
  return map[difficulty] || difficulty
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
</script>

<style lang="scss" scoped>
.course-card {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

/* Grid 模式：封面在上 */
.course-card--grid {
  display: flex;
  flex-direction: column;
}

.course-card--grid .course-cover {
  width: 100%;
  height: 200rpx;
  background: #f5f5f5;
  position: relative;
}

/* List 模式：封面在左 */
.course-card--list {
  display: flex;
}

.course-card--list .course-cover {
  width: 220rpx;
  height: 180rpx;
  background: #f5f5f5;
  flex-shrink: 0;
  position: relative;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 70rpx;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
}

.course-badge {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
}

.badge-paid, .badge-free {
  display: inline-block;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  border-radius: 8rpx;
}

.badge-paid {
  background: #ff6b6b;
  color: #fff;
}

.badge-free {
  background: #51cf66;
  color: #fff;
}

.badge-points {
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  color: #333;
  font-weight: bold;
}

.points-badge {
  position: absolute;
  bottom: 10rpx;
  right: 10rpx;
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;

  text {
    font-size: 20rpx;
    color: #333;
    font-weight: bold;
  }
}

.course-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.course-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.course-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
  flex-wrap: wrap;
  gap: 10rpx;
}

.meta-left {
  display: flex;
  gap: 15rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #666;
}

.course-action {
  margin-top: 15rpx;
}

.action-btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 12rpx 30rpx;
  border-radius: 25rpx;
  font-size: 26rpx;
}
</style>
