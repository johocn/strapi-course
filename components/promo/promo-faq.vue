<template>
  <view class="promo-card promo-faq">
    <text v-if="title" class="section-title">{{ title }}</text>
    <view v-if="items.length" class="faq-list">
      <view
        v-for="(item, index) in items"
        :key="index"
        class="faq-item"
        @click="toggle(index)"
      >
        <view class="faq-question">
          <text class="faq-q">Q</text>
          <text class="faq-qtext">{{ item.q }}</text>
          <text class="faq-arrow" :class="{ 'faq-arrow--open': activeIndex === index }">▾</text>
        </view>
        <view v-if="activeIndex === index" class="faq-answer">
          <text class="faq-a">{{ item.a }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  activity?: any
  config?: any
}>()

const title = computed(() => props.config?.title || '')
const items = computed<any[]>(() => props.config?.items || [])

const activeIndex = ref(-1)

function toggle(index: number) {
  activeIndex.value = activeIndex.value === index ? -1 : index
}
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 20rpx;
}

.faq-item {
  padding: 18rpx 0;
  border-bottom: 2rpx solid var(--c-text-dim);

  &:last-child {
    border-bottom: none;
  }
}

.faq-question {
  display: flex;
  align-items: center;
}

.faq-q {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  margin-right: 12rpx;
  border-radius: 8rpx;
  background: var(--c-primary);
  color: #fff;
  font-size: 24rpx;
  line-height: 40rpx;
  text-align: center;
}

.faq-qtext {
  flex: 1;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--c-text);
  line-height: 1.4;
}

.faq-arrow {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 26rpx;
  color: var(--c-text-dim);
  transition: transform 0.2s;
}

.faq-arrow--open {
  transform: rotate(180deg);
}

.faq-answer {
  padding: 14rpx 0 4rpx 52rpx;
}

.faq-a {
  display: block;
  font-size: 26rpx;
  color: var(--c-text-dim);
  line-height: 1.6;
}
</style>
