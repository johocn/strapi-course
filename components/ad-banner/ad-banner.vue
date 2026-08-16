<template>
  <!-- 加载状态 -->
  <view v-if="loading" class="ad-banner-loading" :style="loadingStyle">
    <view class="ad-loading-spinner" />
  </view>

  <!-- 广告内容 -->
  <view
    v-else-if="visibleContents.length > 0"
    class="ad-banner"
    :class="displayStyleClass"
  >
    <view
      v-for="(content, index) in visibleContents"
      :key="index"
      class="ad-content"
      :class="contentStyleClass(content)"
      :style="contentWrapStyle(content)"
      @click="handleContentClick(content)"
    >
      <!-- ============ 单图广告 ============ -->
      <view v-if="content.contentType === 'single-image'" class="ad-single-image">
        <view class="ad-img-box" :style="imgBoxStyle(content)">
          <image
            v-if="!hasImageError(index, 0) && content.images && content.images.length > 0"
            :src="resolveImageUrl(getImageUrl(content.images[0]))"
            mode="widthFix"
            class="ad-img"
            :style="imgStyle(content)"
            @error="onImageError(index, 0)"
          />
          <view v-else class="ad-img-placeholder">
            <text class="ad-img-placeholder-text">{{ content.name || '广告图片' }}</text>
          </view>

          <!-- 标题覆盖层 -->
          <view
            v-if="content.title"
            class="ad-title-overlay"
            :class="titleAlignClass(content)"
            :style="titleOverlayStyle(content)"
          >
            <text class="ad-title-text" :style="titleTextStyle(content)">{{ content.title }}</text>
          </view>

          <!-- 徽标 -->
          <view
            v-if="content.badgeText"
            class="ad-badge"
            :class="badgePosClass(content)"
            :style="badgeStyle(content)"
          >
            <text class="ad-badge-text" :style="badgeTextStyle(content)">{{ content.badgeText }}</text>
          </view>

          <!-- CTA 按钮 -->
          <view
            v-if="content.ctaText"
            class="ad-cta"
            :class="ctaPosClass(content)"
            :style="ctaStyle(content)"
            @click.stop="handleContentClick(content)"
          >
            <text class="ad-cta-text" :style="ctaTextStyle(content)">{{ content.ctaText }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 多图广告（横向滚动） ============ -->
      <scroll-view
        v-else-if="content.contentType === 'multi-image'"
        scroll-x
        class="ad-multi-scroll"
        :show-scrollbar="false"
      >
        <view class="ad-multi-inner" :style="multiInnerStyle(content)">
          <view
            v-for="(img, imgIdx) in (content.images || [])"
            :key="imgIdx"
            class="ad-multi-item"
            :style="multiItemStyle(content)"
            @click.stop="handleImageClick(content, imgIdx)"
          >
            <image
              v-if="!hasImageError(index, imgIdx)"
              :src="resolveImageUrl(getImageUrl(img))"
              mode="aspectFill"
              class="ad-multi-img"
              @error="onImageError(index, imgIdx)"
            />
            <view v-else class="ad-multi-placeholder">
              <text class="ad-multi-placeholder-text">图片加载失败</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- ============ 轮播广告 ============ -->
      <view v-else-if="content.contentType === 'slideshow'" class="ad-slideshow">
        <swiper
          :autoplay="content.slideshowAutoplay !== false"
          :interval="content.slideshowInterval || 3000"
          :circular="content.slideshowLoop !== false"
          :duration="slideshowDuration(content)"
          class="ad-swiper"
          :style="slideshowStyle(content)"
          @change="onSlideshowChange($event, index)"
        >
          <swiper-item
            v-for="(img, slideIdx) in (content.images || [])"
            :key="slideIdx"
          >
            <view class="ad-slide-item" @click.stop="handleImageClick(content, slideIdx)">
              <image
                v-if="!hasImageError(index, slideIdx)"
                :src="resolveImageUrl(getImageUrl(img))"
                mode="aspectFill"
                class="ad-slide-img"
                @error="onImageError(index, slideIdx)"
              />
              <view v-else class="ad-slide-placeholder">
                <text class="ad-slide-placeholder-text">图片加载失败</text>
              </view>

              <!-- 标题覆盖层（支持 per-image 标题，回退到全局标题） -->
              <view
                v-if="getSlideTitle(content, img)"
                class="ad-title-overlay"
                :class="titleAlignClass(content)"
                :style="titleOverlayStyle(content)"
              >
                <text class="ad-title-text" :style="titleTextStyle(content)">{{ getSlideTitle(content, img) }}</text>
                <text
                  v-if="getSlideSubtitle(content, img)"
                  class="ad-subtitle-text"
                  :style="subtitleTextStyle(content)"
                >{{ getSlideSubtitle(content, img) }}</text>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <!-- 指示点 -->
        <view
          v-if="content.slideshowShowDots !== false && (content.images?.length || 0) > 1"
          class="ad-dots"
          :class="dotsPositionClass(content)"
        >
          <view
            v-for="(img, dotIdx) in (content.images || [])"
            :key="dotIdx"
            class="ad-dot"
            :class="{ 'ad-dot-active': dotIdx === getSlideshowCurrent(index) }"
          />
        </view>
      </view>

      <!-- ============ 视频广告 ============ -->
      <view v-else-if="content.contentType === 'video'" class="ad-video-wrap" :style="videoWrapStyle(content)">
        <video
          v-if="content.videoUrl"
          :src="resolveVideoUrl(content.videoUrl)"
          :poster="resolveImageUrl(content.videoPoster)"
          :autoplay="content.videoAutoplay || false"
          :muted="content.videoMuted !== false"
          :loop="content.videoLoop || false"
          :controls="true"
          :show-center-play-btn="true"
          class="ad-video-player"
          :style="videoStyle(content)"
        />
      </view>

      <!-- ============ HTML 广告 ============ -->
      <view v-else-if="content.contentType === 'html'" class="ad-html-wrap" :style="htmlWrapStyle(content)">
        <rich-text :nodes="content.htmlContent || ''" />
      </view>
    </view>
  </view>

  <!-- 无广告内容时不渲染任何节点 -->
</template>

<script setup>import { ref, computed, onMounted } from "vue";
import { getAdZone } from "@/utils/ad-api";
import { getImageUrl as resolveEnvImageUrl } from "@/utils/env";
const props = defineProps({
  position: { type: String, required: true },
  frequencyLimit: { type: Number, default: 0 }
});
const emit = defineEmits(["click"]);
const loading = ref(true);
const zone = ref(null);
const contents = ref([]);
const imageErrors = ref({});
const slideshowCurrent = ref({});
const displayMode = computed(() => zone.value?.displayMode || "stack");
const visibleContents = computed(() => {
  if (contents.value.length === 0)
    return [];
  if (displayMode.value === "single") {
    return [contents.value[0]];
  }
  return contents.value;
});
const displayStyleClass = computed(() => {
  const first = visibleContents.value[0];
  if (!first?.displayStyle)
    return "ad-style-banner";
  return `ad-style-${first.displayStyle}`;
});
const loadingStyle = computed(() => {
  const w = zone.value?.suggestedWidth;
  const h = zone.value?.suggestedHeight;
  const style = {};
  if (h)
    style["min-height"] = `${h}rpx`;
  if (w)
    style["width"] = `100%`;
  return style;
});
function resolveImageUrl(url) {
  if (!url)
    return "";
  return resolveEnvImageUrl(url);
}
function resolveVideoUrl(url) {
  if (!url)
    return "";
  if (url.startsWith("http://") || url.startsWith("https://"))
    return url;
  return resolveImageUrl(url);
}
function getImageUrl(img) {
  if (typeof img === "string")
    return img;
  return img?.url || "";
}
function getSlideTitle(content, img) {
  if (typeof img === "object" && img.title)
    return img.title;
  return content.title || "";
}
function getSlideSubtitle(content, img) {
  if (typeof img === "object" && img.subtitle)
    return img.subtitle;
  return content.subtitle || "";
}
function checkFrequency() {
  if (props.frequencyLimit <= 0)
    return true;
  const key = `ad_freq_${props.position}`;
  const lastShown = uni.getStorageSync(key);
  if (lastShown) {
    const elapsed = Date.now() - Number(lastShown);
    if (elapsed < props.frequencyLimit * 60 * 60 * 1e3) {
      return false;
    }
  }
  uni.setStorageSync(key, String(Date.now()));
  return true;
}
function hasImageError(contentIndex, imageIndex) {
  return !!imageErrors.value[`${contentIndex}-${imageIndex}`];
}
function onImageError(contentIndex, imageIndex) {
  imageErrors.value[`${contentIndex}-${imageIndex}`] = true;
}
function getSlideshowCurrent(contentIndex) {
  return slideshowCurrent.value[contentIndex] || 0;
}
function onSlideshowChange(event, contentIndex) {
  if (event?.detail?.current !== void 0) {
    slideshowCurrent.value[contentIndex] = event.detail.current;
  }
}
function slideshowDuration(content) {
  switch (content.slideshowEffect) {
    case "none":
      return 0;
    case "fade":
      return 600;
    default:
      return 500;
  }
}
function handleContentClick(content) {
  emit("click", content);
  if (!content.linkUrl || content.linkType === "none")
    return;
  if (content.linkType === "internal") {
    uni.navigateTo({
      url: content.linkUrl,
      fail: () => {
        uni.switchTab({ url: content.linkUrl, fail: () => {
          console.warn("[ad-banner] \u5185\u90E8\u8DF3\u8F6C\u5931\u8D25:", content.linkUrl);
        } });
      }
    });
  } else if (content.linkType === "external") {
    if (content.linkTarget === "_blank") {
      window.open(content.linkUrl, "_blank");
    } else {
      window.location.href = content.linkUrl;
    }
    uni.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(content.linkUrl)}`,
      fail: () => {
        console.warn("[ad-banner] \u5916\u90E8\u94FE\u63A5\u8DF3\u8F6C\u5931\u8D25\uFF0C\u9700\u521B\u5EFA webview \u9875\u9762");
        uni.showToast({ title: "\u6682\u4E0D\u652F\u6301\u6253\u5F00\u5916\u90E8\u94FE\u63A5", icon: "none" });
      }
    });
  }
}
function handleImageClick(content, _imageIndex) {
  emit("click", content);
  if (!content.linkUrl || content.linkType === "none")
    return;
  handleContentClick(content);
}
function contentWrapStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  if (content.backgroundColor)
    style["background-color"] = content.backgroundColor;
  return style;
}
function contentStyleClass(content) {
  const classes = [];
  if (content.displayStyle)
    classes.push(`ad-content-${content.displayStyle}`);
  return classes.join(" ");
}
function imgBoxStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  style["overflow"] = "hidden";
  return style;
}
function imgStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function multiInnerStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function multiItemStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function slideshowStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function videoWrapStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function videoStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  return style;
}
function htmlWrapStyle(content) {
  const style = {};
  if (content.borderRadius)
    style["border-radius"] = `${content.borderRadius}rpx`;
  if (content.backgroundColor)
    style["background-color"] = content.backgroundColor;
  return style;
}
function titleAlignClass(content) {
  return `ad-title-${content.titleAlign || "left"}`;
}
function titleOverlayStyle(content) {
  const style = {};
  style["background"] = "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))";
  return style;
}
function titleTextStyle(content) {
  const style = {};
  if (content.titleColor)
    style["color"] = content.titleColor;
  if (content.titleFontSize)
    style["font-size"] = `${content.titleFontSize * 2}rpx`;
  if (content.titleFontWeight)
    style["font-weight"] = content.titleFontWeight;
  if (content.titleOverflow === "ellipsis") {
    style["overflow"] = "hidden";
    style["white-space"] = "nowrap";
    style["text-overflow"] = "ellipsis";
  }
  return style;
}
function subtitleTextStyle(content) {
  const style = {};
  if (content.subtitleColor)
    style["color"] = content.subtitleColor;
  if (content.subtitleFontSize)
    style["font-size"] = `${content.subtitleFontSize}px`;
  return style;
}
function ctaPosClass(content) {
  return `ad-cta-${content.ctaPosition || "bottom"}`;
}
function ctaStyle(content) {
  const style = {};
  if (content.ctaBgColor)
    style["background-color"] = content.ctaBgColor;
  if (content.ctaTextColor)
    style["color"] = content.ctaTextColor;
  return style;
}
function ctaTextStyle(content) {
  const style = {};
  if (content.ctaTextColor)
    style["color"] = content.ctaTextColor;
  return style;
}
function badgePosClass(content) {
  return `ad-badge-${content.badgePosition || "top-right"}`;
}
function badgeStyle(content) {
  const style = {};
  if (content.badgeBgColor)
    style["background-color"] = content.badgeBgColor;
  return style;
}
function badgeTextStyle(content) {
  const style = {};
  if (content.badgeTextColor)
    style["color"] = content.badgeTextColor;
  return style;
}
function dotsPositionClass(_content) {
  return "ad-dots-bottom";
}
async function fetchAdZone() {
  loading.value = true;
  try {
    const result = await getAdZone(props.position);
    zone.value = result.zone;
    contents.value = result.contents || [];
  } catch (e) {
    console.error("[ad-banner] \u83B7\u53D6\u5E7F\u544A\u6570\u636E\u5931\u8D25:", e);
    zone.value = null;
    contents.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  if (!checkFrequency()) {
    loading.value = false;
    return;
  }
  fetchAdZone();
});
</script>

<style lang="scss" scoped>
/* ============ 基础容器 ============ */
.ad-banner {
  width: 100%;
  position: relative;
}

.ad-content {
  width: 100%;
  position: relative;
  overflow: hidden;
}

/* displayStyle 样式 */
.ad-style-banner .ad-content {
  display: block;
}
.ad-style-card .ad-content {
  padding: 0;
  margin: 20rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
}
.ad-style-inline .ad-content {
  display: inline-block;
}

/* ============ 加载状态 ============ */
.ad-banner-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200rpx;
  width: 100%;
}

.ad-loading-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: ad-spin 0.8s linear infinite;
}

@keyframes ad-spin {
  to { transform: rotate(360deg); }
}

/* ============ 单图广告 ============ */
.ad-single-image {
  width: 100%;
  position: relative;
}

.ad-img-box {
  width: 100%;
  position: relative;
  overflow: hidden;
}

.ad-img {
  width: 100%;
  display: block;
}

.ad-img-placeholder {
  width: 100%;
  min-height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.ad-img-placeholder-text {
  font-size: 24rpx;
  color: #ccc;
}

/* ---- 标题覆盖层 ---- */
.ad-title-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 24rpx 20rpx;
  display: flex;
  flex-direction: column;
}

.ad-title-left {
  justify-content: flex-start;
}
.ad-title-center {
  justify-content: center;
}
.ad-title-right {
  justify-content: flex-end;
}

.ad-title-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.4;
  max-width: 100%;
}

.ad-subtitle-text {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  opacity: 0.85;
}

/* ---- CTA 按钮 ---- */
.ad-cta {
  position: absolute;
  padding: 12rpx 32rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  background-color: #FF4444;
  z-index: 2;
}

.ad-cta-top {
  top: 24rpx;
  left: 50%;
  transform: translateX(-50%);
}
.ad-cta-center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.ad-cta-bottom {
  bottom: 24rpx;
  left: 50%;
  transform: translateX(-50%);
}

.ad-cta-text {
  font-size: 26rpx;
  color: #ffffff;
  line-height: 1.2;
}

/* ---- 徽标 ---- */
.ad-badge {
  position: absolute;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  background-color: #FF4444;
  z-index: 3;
}

.ad-badge-top-left {
  top: 16rpx;
  left: 16rpx;
}
.ad-badge-top-right {
  top: 16rpx;
  right: 16rpx;
}
.ad-badge-bottom-left {
  bottom: 16rpx;
  left: 16rpx;
}
.ad-badge-bottom-right {
  bottom: 16rpx;
  right: 16rpx;
}

.ad-badge-text {
  font-size: 22rpx;
  color: #ffffff;
  line-height: 1.2;
}

/* ============ 多图广告 ============ */
.ad-multi-scroll {
  width: 100%;
  white-space: nowrap;
}

.ad-multi-inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 20rpx;
}

.ad-multi-item {
  display: inline-block;
  width: 400rpx;
  height: 240rpx;
  overflow: hidden;
  flex-shrink: 0;
}

.ad-multi-img {
  width: 100%;
  height: 100%;
  display: block;
}

.ad-multi-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.ad-multi-placeholder-text {
  font-size: 22rpx;
  color: #ccc;
}

/* ============ 轮播广告 ============ */
.ad-slideshow {
  width: 100%;
  position: relative;
}

.ad-swiper {
  width: 100%;
  height: 300rpx;
}

.ad-slide-item {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.ad-slide-img {
  width: 100%;
  height: 100%;
  display: block;
}

.ad-slide-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.ad-slide-placeholder-text {
  font-size: 22rpx;
  color: #ccc;
}

/* ---- 指示点 ---- */
.ad-dots {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 10rpx;
  z-index: 2;
}

.ad-dots-bottom {
  bottom: 20rpx;
}

.ad-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transition: all 0.3s;
}

.ad-dot-active {
  background: #ffffff;
  width: 32rpx;
  border-radius: 7rpx;
}

/* ============ 视频广告 ============ */
.ad-video-wrap {
  width: 100%;
  overflow: hidden;
}

.ad-video-player {
  width: 100%;
  height: 400rpx;
  display: block;
}

/* ============ HTML 广告 ============ */
.ad-html-wrap {
  width: 100%;
  overflow: hidden;
}

/* ============ displayStyle: float / fullscreen ============ */
.ad-style-float {
  position: fixed;
  bottom: 120rpx;
  right: 20rpx;
  z-index: 999;
  width: auto;
  max-width: 300rpx;
}

.ad-style-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.ad-style-fullscreen .ad-content {
  height: 100vh;
}
</style>
