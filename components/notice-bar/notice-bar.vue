<template>
  <!-- 有公告数据时显示跑马灯 -->
  <view v-if="visible" class="notice-bar" @click="openPopup">
    <view class="notice-icon">
      <text class="notice-icon-text">📢</text>
    </view>
    <view class="notice-content">
      <!-- 多条公告垂直轮播 -->
      <view class="notice-scroll-track" :style="trackStyle">
        <view
          v-for="(content, idx) in contents"
          :key="idx"
          class="notice-text-row"
        >
          <text
            class="notice-text"
            :class="{ 'notice-text-animate': shouldAnimate }"
            :style="textStyle(content)"
          >{{ content.title || '' }}</text>
        </view>
      </view>
    </view>
    <!-- 公告数量指示器 -->
    <view v-if="contents.length > 1" class="notice-count">
      <text class="notice-count-text">{{ currentIndex + 1 }}/{{ contents.length }}</text>
    </view>
    <view class="notice-arrow">
      <text class="notice-arrow-text">查看 ›</text>
    </view>
  </view>

  <!-- 公告内容弹窗 -->
  <view v-if="showPopup" class="notice-popup-mask" @click="showPopup = false">
    <view class="notice-popup" @click.stop>
      <view class="notice-popup-header">
        <text class="notice-popup-title">{{ currentContent?.name || '公告详情' }}</text>
        <text class="notice-popup-close" @click="showPopup = false">×</text>
      </view>
      <scroll-view scroll-y class="notice-popup-body">
        <rich-text :nodes="currentContent?.htmlContent || ''" />
      </scroll-view>
      <!-- 多条公告切换 -->
      <view v-if="contents.length > 1" class="notice-popup-nav">
        <view class="nav-btn" :class="{ 'nav-btn-disabled': currentIndex === 0 }" @click="prevNotice">
          <text>‹ 上一条</text>
        </view>
        <text class="nav-index">{{ currentIndex + 1 }} / {{ contents.length }}</text>
        <view class="nav-btn" :class="{ 'nav-btn-disabled': currentIndex === contents.length - 1 }" @click="nextNotice">
          <text>下一条 ›</text>
        </view>
      </view>
      <view class="notice-popup-footer">
        <view class="notice-popup-btn" @click="showPopup = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { getAdZone } from "@/utils/ad-api";
const props = defineProps({
  position: { type: String, required: true },
  interval: { type: Number, default: 4000 }
});
const loading = ref(true);
const contents = ref([]);
const showPopup = ref(false);
const currentIndex = ref(0);
const shouldAnimate = ref(true);
let rotateTimer = null;
const currentContent = computed(() => {
  if (contents.value.length === 0)
    return null;
  return contents.value[currentIndex.value] || contents.value[0];
});
const visible = computed(() => {
  return !loading.value && contents.value.length > 0;
});
const trackStyle = computed(() => {
  return {
    transform: `translateY(-${currentIndex.value * 64}rpx)`,
    transition: "transform 0.4s ease"
  };
});
function textStyle(content) {
  const style = {};
  if (content.titleColor)
    style["color"] = content.titleColor;
  if (content.titleFontSize)
    style["font-size"] = `${content.titleFontSize}px`;
  return style;
}
function openPopup() {
  stopRotate();
  showPopup.value = true;
}
function closePopup() {
  showPopup.value = false;
  startRotate();
}
function prevNotice() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}
function nextNotice() {
  if (currentIndex.value < contents.value.length - 1) {
    currentIndex.value++;
  }
}
function startRotate() {
  stopRotate();
  if (contents.value.length <= 1)
    return;
  rotateTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % contents.value.length;
  }, props.interval);
}
function stopRotate() {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
}
watch(showPopup, (val) => {
  if (!val) {
    startRotate();
  }
});
async function fetchNotice() {
  loading.value = true;
  try {
    const result = await getAdZone(props.position);
    contents.value = result.contents || [];
    currentIndex.value = 0;
    startRotate();
  } catch (e) {
    console.error("[notice-bar] \u83B7\u53D6\u516C\u544A\u6570\u636E\u5931\u8D25:", e);
    contents.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  fetchNotice();
});
onUnmounted(() => {
  stopRotate();
});
</script>

<style lang="scss" scoped>
.notice-bar {
  display: flex;
  align-items: center;
  width: 100%;
  height: 64rpx;
  background: #fff;
  padding: 0 20rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.notice-icon {
  flex-shrink: 0;
  margin-right: 12rpx;
}

.notice-icon-text {
  font-size: 32rpx;
}

.notice-content {
  flex: 1;
  overflow: hidden;
  height: 64rpx;
}

.notice-scroll-track {
  height: 64rpx;
}

.notice-text-row {
  height: 64rpx;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
}

.notice-text {
  font-size: 26rpx;
  color: #333;
  display: inline-block;
  white-space: nowrap;
}

.notice-text-animate {
  animation: notice-marquee 12s linear infinite;
}

@keyframes notice-marquee {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

.notice-count {
  flex-shrink: 0;
  margin-left: 8rpx;
  padding: 4rpx 12rpx;
  background: #f0f0f0;
  border-radius: 20rpx;
}

.notice-count-text {
  font-size: 20rpx;
  color: #999;
}

.notice-arrow {
  flex-shrink: 0;
  margin-left: 12rpx;
}

.notice-arrow-text {
  font-size: 22rpx;
  color: #999;
  white-space: nowrap;
}

/* ============ 弹窗 ============ */
.notice-popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notice-popup {
  width: 86%;
  max-width: 640rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notice-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 30rpx 20rpx;
  border-bottom: 1rpx solid #eee;
}

.notice-popup-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.notice-popup-close {
  font-size: 40rpx;
  color: #999;
  padding: 0 10rpx;
  line-height: 1;
}

.notice-popup-body {
  flex: 1;
  padding: 30rpx;
  overflow-y: auto;
}

/* ============ 弹窗内多条切换 ============ */
.notice-popup-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  border-top: 1rpx solid #eee;
}

.nav-btn {
  padding: 8rpx 20rpx;
  font-size: 26rpx;
  color: #0056D2;
}

.nav-btn-disabled {
  color: #ccc;
}

.nav-index {
  font-size: 24rpx;
  color: #999;
}

.notice-popup-footer {
  padding: 20rpx 30rpx 30rpx;
}

.notice-popup-btn {
  text-align: center;
  padding: 20rpx;
  background: #0056D2;
  border-radius: 40rpx;
  color: #fff;
  font-size: 28rpx;
}
</style>
