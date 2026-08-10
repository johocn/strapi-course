<template>
  <!-- 有已选条件时显示 -->
  <view v-if="activeChips.length > 0" class="active-filters">
    <view class="chips-row">
      <text class="chips-label">已选：</text>
      <view
        v-for="chip in activeChips"
        :key="chip.type + chip.value"
        class="active-chip"
        @click="$emit('remove', { type: chip.type, value: chip.value })"
      >
        <text>{{ chip.label }}</text>
        <text class="chip-close">×</text>
      </view>
      <text class="clear-all" @click="$emit('clear-all')">清除全部</text>
      <text class="result-count">共 <text class="count-num">{{ total }}</text> 门</text>
    </view>
  </view>

  <!-- 无已选条件但有结果：只显示计数 -->
  <view v-else-if="hasResult" class="result-only">
    <text class="result-count">共 <text class="count-num">{{ total }}</text> 门课程</text>
  </view>

  <!-- 无结果：空状态 -->
  <view v-else class="empty-state">
    <text class="empty-icon">🔍</text>
    <text class="empty-text">没有符合条件的课程</text>
    <text class="empty-hint" @click="$emit('clear-all')">尝试减少筛选条件</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  type CourseFilterState,
  type PriceType
} from '../../utils/course-query'
import type { Tag } from '../../services/api'

const props = defineProps<{
  filters: CourseFilterState
  priceType: PriceType
  category: string
  categoryList: Array<{ id: string; name: string }>
  tags: Tag[]
  total: number
  hasResult: boolean
}>()

defineEmits<{
  (e: 'remove', payload: { type: string; value: string }): void
  (e: 'clear-all'): void
}>()

interface ActiveChip {
  type: string
  value: string
  label: string
}

const activeChips = computed<ActiveChip[]>(() => {
  const chips: ActiveChip[] = []

  // 价格类型（非 all）
  if (props.priceType !== 'all') {
    const labelMap: Record<string, string> = {
      free: '免费',
      paid: '付费',
      featured: '精选'
    }
    chips.push({ type: 'priceType', value: props.priceType, label: labelMap[props.priceType] || props.priceType })
  }

  // 分类（非 all）
  if (props.category !== 'all') {
    const cat = props.categoryList.find(c => c.id === props.category)
    if (cat) chips.push({ type: 'category', value: props.category, label: cat.name })
  }

  // 难度
  props.filters.difficulty.forEach(d => {
    const opt = DIFFICULTY_OPTIONS.find(o => o.value === d)
    if (opt) chips.push({ type: 'difficulty', value: d, label: opt.label })
  })

  // 语言
  props.filters.language.forEach(l => {
    const opt = LANGUAGE_OPTIONS.find(o => o.value === l)
    if (opt) chips.push({ type: 'language', value: l, label: opt.label })
  })

  // 价格区间（非默认）
  if (props.filters.priceRange[0] > 0 || props.filters.priceRange[1] < 999) {
    const [min, max] = props.filters.priceRange
    chips.push({ type: 'priceRange', value: 'range', label: `¥${min}-${max}` })
  }

  // 标签
  props.filters.tags.forEach(t => {
    const tag = props.tags.find(tg => tg.documentId === t)
    if (tag) chips.push({ type: 'tags', value: t, label: `#${tag.name}` })
  })

  return chips
})
</script>

<style lang="scss" scoped>
.active-filters {
  padding: 0 30rpx;
  margin-bottom: 16rpx;
}

.chips-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chips-label {
  font-size: 22rpx;
  color: #999;
}

.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  background: #667eea;
  color: #fff;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.chip-close {
  font-size: 24rpx;
  line-height: 1;
}

.clear-all {
  font-size: 22rpx;
  color: #ff6b6b;
  margin-left: 8rpx;
}

.result-count {
  margin-left: auto;
  font-size: 22rpx;
  color: #666;
}

.count-num {
  color: #667eea;
  font-weight: bold;
}

.result-only {
  padding: 0 30rpx;
  margin-bottom: 16rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #667eea;
}
</style>
