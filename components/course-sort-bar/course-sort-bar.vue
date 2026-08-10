<template>
  <view class="sort-bar">
    <!-- 排序选项（横滚） -->
    <scroll-view scroll-x class="sort-scroll">
      <view class="sort-list">
        <view
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['sort-item', { active: modelValue === opt.key }]"
          @click="$emit('update:modelValue', opt.key)"
        >
          <text>{{ opt.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 视图切换图标 -->
    <view class="view-toggle">
      <view
        :class="['toggle-btn', { active: viewMode === 'grid' }]"
        @click="$emit('update:viewMode', 'grid')"
      >
        <text>⊞</text>
      </view>
      <view
        :class="['toggle-btn', { active: viewMode === 'list' }]"
        @click="$emit('update:viewMode', 'list')"
      >
        <text>☰</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getSortOptions, type SortKey, type ViewMode } from '../../utils/course-query'

const props = withDefaults(defineProps<{
  modelValue: SortKey
  viewMode: ViewMode
  showRating?: boolean
}>(), {
  showRating: false
})

defineEmits<{
  (e: 'update:modelValue', value: SortKey): void
  (e: 'update:viewMode', value: ViewMode): void
}>()

const sortOptions = computed(() => getSortOptions(props.showRating))
</script>

<style lang="scss" scoped>
.sort-bar {
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  margin-bottom: 20rpx;
  gap: 20rpx;
}

.sort-scroll {
  flex: 1;
  white-space: nowrap;
}

.sort-list {
  display: inline-flex;
  gap: 16rpx;
}

.sort-item {
  display: inline-block;
  padding: 10rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  border: 1rpx solid #eee;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-color: transparent;
  }
}

.view-toggle {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.toggle-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12rpx;
  border: 1rpx solid #eee;

  text {
    font-size: 32rpx;
    color: #999;
  }

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;

    text {
      color: #fff;
    }
  }
}
</style>
