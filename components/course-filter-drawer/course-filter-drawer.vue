<template>
  <!-- 遮罩层 -->
  <view v-if="visible" class="drawer-mask" @click="$emit('update:visible', false)">
    <!-- 弹层主体 -->
    <view class="drawer" @click.stop>
      <!-- 头部 -->
      <view class="drawer-header">
        <text class="drawer-title">筛选</text>
        <text class="drawer-close" @click="$emit('update:visible', false)">×</text>
      </view>

      <!-- 内容区 -->
      <scroll-view scroll-y class="drawer-body">
        <!-- 难度 -->
        <view class="filter-section">
          <text class="section-title">难度</text>
          <view class="checkbox-group">
            <view
              v-for="opt in DIFFICULTY_OPTIONS"
              :key="opt.value"
              :class="['checkbox-item', { checked: localState.difficulty.includes(opt.value) }]"
              @click="toggleArray('difficulty', opt.value)"
            >
              <text>{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 语言 -->
        <view class="filter-section">
          <text class="section-title">语言</text>
          <view class="checkbox-group">
            <view
              v-for="opt in LANGUAGE_OPTIONS"
              :key="opt.value"
              :class="['checkbox-item', { checked: localState.language.includes(opt.value) }]"
              @click="toggleArray('language', opt.value)"
            >
              <text>{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 价格区间 -->
        <view class="filter-section">
          <text class="section-title">价格区间</text>
          <view class="price-range">
            <input
              class="price-input"
              type="number"
              :value="localState.priceRange[0]"
              placeholder="最低"
              @input="updatePrice(0, $event)"
            />
            <text class="price-separator">—</text>
            <input
              class="price-input"
              type="number"
              :value="localState.priceRange[1]"
              placeholder="最高"
              @input="updatePrice(1, $event)"
            />
          </view>
        </view>

        <!-- 标签 -->
        <view class="filter-section">
          <text class="section-title">标签</text>
          <view v-if="tags.length === 0" class="empty-tags">
            <text>暂无标签</text>
          </view>
          <view v-else class="checkbox-group">
            <view
              v-for="tag in tags"
              :key="tag.documentId"
              :class="['checkbox-item', { checked: localState.tags.includes(tag.documentId) }]"
              @click="toggleArray('tags', tag.documentId)"
            >
              <text>{{ tag.name }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部操作 -->
      <view class="drawer-footer">
        <view class="footer-btn footer-reset" @click="handleReset">
          <text>重置</text>
        </view>
        <view class="footer-btn footer-apply" @click="handleApply">
          <text>确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  DEFAULT_FILTER_STATE,
  type CourseFilterState
} from '../../utils/course-query'
import type { Tag } from '../../services/api'

const props = defineProps<{
  visible: boolean
  modelValue: CourseFilterState
  tags: Tag[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'apply', value: CourseFilterState): void
  (e: 'reset'): void
}>()

// 本地副本（编辑中不立即触发外部更新，点确定才 apply）
const localState = ref<CourseFilterState>({ ...DEFAULT_FILTER_STATE })

// 弹层打开时同步外部值
watch(() => props.visible, (v) => {
  if (v) {
    localState.value = JSON.parse(JSON.stringify(props.modelValue))
  }
})

function toggleArray(field: 'difficulty' | 'language' | 'tags', value: string) {
  const arr = localState.value[field]
  const idx = arr.indexOf(value)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    arr.push(value)
  }
}

function updatePrice(index: 0 | 1, e: any) {
  const val = Number(e.detail.value) || 0
  let range: [number, number] = [...localState.value.priceRange]
  range[index] = val
  // 自动交换 min > max
  if (range[0] > range[1]) {
    range = [range[1], range[0]]
  }
  localState.value.priceRange = range
}

function handleApply() {
  emit('apply', JSON.parse(JSON.stringify(localState.value)))
  emit('update:visible', false)
}

function handleReset() {
  localState.value = JSON.parse(JSON.stringify(DEFAULT_FILTER_STATE))
  emit('reset')
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.drawer {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.drawer-close {
  font-size: 40rpx;
  color: #999;
  line-height: 1;
}

.drawer-body {
  flex: 1;
  padding: 20rpx 30rpx;
}

.filter-section {
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.checkbox-item {
  padding: 12rpx 28rpx;
  background: #f5f5f5;
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #666;

  &.checked {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.price-range {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.price-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.price-separator {
  color: #999;
  font-size: 28rpx;
}

.empty-tags {
  padding: 30rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.drawer-footer {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx;
  border-top: 1rpx solid #eee;
}

.footer-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.footer-reset {
  background: #f5f5f5;
  color: #666;
}

.footer-apply {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
</style>
