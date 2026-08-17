<template>
  <view class="filter-chips">
    <!-- 快捷芯片（互斥单选） -->
    <view
      v-for="opt in PRICE_TYPE_OPTIONS"
      :key="opt.value"
      :class="['chip', { active: modelValue === opt.value }]"
      @click="$emit('update:modelValue', opt.value)"
    >
      <text>{{ opt.label }}</text>
    </view>

    <!-- 筛选按钮（打开弹层） -->
    <view class="chip chip-filter" @click="$emit('open-drawer')">
      <text>▦ 筛选</text>
      <view v-if="activeFilterCount > 0" class="filter-badge">
        <text>{{ activeFilterCount }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PRICE_TYPE_OPTIONS, type PriceType, type CourseFilterState } from '../../utils/course-query'

const props = defineProps<{
  modelValue: PriceType
  filterState: CourseFilterState
}>()

defineEmits<{
  (e: 'update:modelValue', value: PriceType): void
  (e: 'open-drawer'): void
}>()

/** 弹层内已选条件数量（用于角标显示） */
const activeFilterCount = computed(() => {
  let count = 0
  if (props.filterState.difficulty.length > 0) count += props.filterState.difficulty.length
  if (props.filterState.language.length > 0) count += props.filterState.language.length
  if (props.filterState.priceRange[0] > 0 || props.filterState.priceRange[1] < 999) count += 1
  if (props.filterState.tags.length > 0) count += props.filterState.tags.length
  return count
})
</script>

<style lang="scss" scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 30rpx;
  margin-bottom: 16rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.chip {
  display: inline-block;
  padding: 10rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  border: 1rpx solid #eee;
  position: relative;
  flex-shrink: 0;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-color: transparent;
  }
}

.chip-filter {
  margin-left: auto;
  color: #667eea;
  border-color: #667eea;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
}

.filter-badge {
  min-width: 28rpx;
  height: 28rpx;
  background: #ff6b6b;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 18rpx;
    color: #fff;
    line-height: 1;
  }
}
</style>
