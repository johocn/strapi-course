<template>
  <view class="page-container">
    <!-- 导航栏 -->
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text>←</text>
      </view>
      <text class="nav-title">商品详情</text>
      <view class="nav-share" @click="showSharePoster = true">
        <text class="share-icon">📤</text>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>

    <!-- 加载失败 -->
    <view v-else-if="error" class="error-state">
      <text class="error-icon">😢</text>
      <text class="error-text">商品不存在或已下架</text>
      <view class="error-btn" @click="goBack">返回列表</view>
    </view>

    <!-- 商品详情 -->
    <view v-else-if="product" class="detail-content">
      <!-- 商品图片 -->
      <view class="product-image-section">
        <image
          v-if="product.coverImageUrl"
          :src="product.coverImageUrl"
          mode="aspectFill"
          class="product-cover"
        />
        <view v-else class="image-placeholder">
          <text>🎁</text>
        </view>
        <!-- 积分兑换徽章 -->
        <view class="exchange-badge">
          <text>积分兑换</text>
        </view>
      </view>

      <!-- 价格信息 -->
      <view class="price-section">
        <view class="price-row">
          <text class="price-main">{{ priceLabel }}</text>
          <text v-if="product.originalPrice > 0" class="price-original">¥{{ product.originalPrice }}</text>
        </view>
        <text class="product-stock">库存: {{ product.stock }}{{ product.maxPerUser > 0 ? ` · 限购${product.maxPerUser}件` : '' }}</text>
      </view>

      <!-- 商品名称 -->
      <view class="info-section">
        <text class="product-name">{{ product.name }}</text>
        <text v-if="product.subtitle" class="product-subtitle">{{ product.subtitle }}</text>
      </view>

      <!-- 标签 -->
      <view v-if="product.deliveryType || product.category" class="tags-section">
        <text v-if="product.deliveryType" class="tag delivery">{{ deliveryLabel }}</text>
        <text v-if="product.category" class="tag category">{{ product.category }}</text>
        <text v-if="product.allowCrossChannel" class="tag cross-channel">支持跨渠道</text>
        <text v-if="product.allowGlobalPoints === false" class="tag channel-only">仅限渠道积分</text>
      </view>

      <!-- 商品描述 -->
      <view v-if="product.description" class="desc-section">
        <text class="section-title">商品介绍</text>
        <text class="desc-text">{{ product.description }}</text>
      </view>

      <!-- 详细说明 -->
      <view v-if="product.detail" class="desc-section">
        <text class="section-title">详细信息</text>
        <rich-text v-if="isHtmlContent(product.detail)" :nodes="product.detail" class="rich-detail" />
        <text v-else class="desc-text">{{ product.detail }}</text>
      </view>

      <!-- 图片列表 -->
      <view v-if="product.imagesList && product.imagesList.length > 0" class="images-section">
        <text class="section-title">商品图片</text>
        <view class="image-list">
          <image
            v-for="(img, idx) in product.imagesList"
            :key="idx"
            :src="img"
            mode="widthFix"
            class="detail-image"
            @click="previewImage(idx)"
          />
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view v-if="product && !loading && !error" class="bottom-bar">
      <view class="share-action" @click="showSharePoster = true">
        <text class="action-icon">📤</text>
        <text class="action-text">分享好友</text>
      </view>
      <view class="exchange-action" @click="goExchange">
        <text>{{ exchangeBtnText }}</text>
      </view>
    </view>

    <!-- 海报组件 -->
    <share-poster
      :visible="showSharePoster"
      :config="posterConfig"
      @close="showSharePoster = false"
    />
  </view>
</template>

<script setup>import { ref, computed } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getPointProductDetail, getPointBalance } from "../../services/api";
import { getUser } from "../../utils/storage";
import { getStoredAuthConfig } from "../../services/auth-config";
import { validateLogin } from "../../utils/auth";
import { getImageUrl, BASE_URL, resolveMediaUrl } from "../../utils/env";
const product = ref(null);
const loading = ref(true);
const error = ref(false);
const showSharePoster = ref(false);
const pointsBalance = ref(0);
const productId = ref("");
const siteConfig = getStoredAuthConfig();
const deliveryLabels = {
  express: "\u5FEB\u9012\u914D\u9001",
  self_pickup: "\u5230\u5E97\u81EA\u63D0",
  both: "\u5FEB\u9012/\u81EA\u63D0"
};
const deliveryLabel = computed(() => {
  return deliveryLabels[product.value?.deliveryType] || product.value?.deliveryType || "";
});
const priceLabel = computed(() => {
  if (!product.value)
    return "";
  const mode = product.value.salesMode || "points_only";
  const points = product.value.pointsCost || 0;
  const price = parseFloat(String(product.value.price || 0)) || 0;
  if (mode === "purchase_only") {
    return price > 0 ? `\xA5${price} \u5230\u5E97\u652F\u4ED8` : "";
  }
  if (mode === "hybrid") {
    const pointPart = points > 0 ? `${points} \u79EF\u5206` : "";
    const pricePart = price > 0 ? `+ \xA5${price} \u5230\u5E97\u4ED8` : "";
    return `${pointPart} ${pricePart}`.trim();
  }
  return points > 0 ? `${points} \u79EF\u5206` : "";
});
const exchangeBtnText = computed(() => {
  if (!product.value)
    return "\u5151\u6362";
  if (product.value.stock <= 0)
    return "\u5DF2\u552E\u7F44";
  const mode = product.value.salesMode || "points_only";
  if (mode === "purchase_only")
    return "\u7ACB\u5373\u8D2D\u4E70";
  if (pointsBalance.value < product.value.pointsCost)
    return "\u79EF\u5206\u4E0D\u8DB3";
  return "\u7ACB\u5373\u5151\u6362";
});
const posterConfig = computed(() => {
  if (!product.value)
    return {};
  const user = getUser();
  return {
    templateCode: "product_share",
    pagePath: `pages/exchange/detail?id=${productId.value}`,
    variables: {
      user_name: user?.nickname || user?.name || siteConfig?.posterDefaultUserName || "",
      user_avatar: user?.avatar ? getImageUrl(user.avatar) : resolveMediaUrl(siteConfig?.posterDefaultUserAvatar) || "",
      product_image: product.value.coverImageUrl || "",
      product_name: product.value.name || "",
      product_price: priceLabel.value || "",
      recommend_reason: product.value.subtitle || product.value.description || siteConfig?.posterDefaultRecommendReason || ""
    }
  };
});
function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.switchTab({ url: "/pages/exchange/exchange" });
  }
}
function goExchange() {
  if (!validateLogin()) {
    uni.showToast({ title: "\u8BF7\u5148\u767B\u5F55", icon: "none" });
    setTimeout(() => {
      uni.switchTab({ url: "/pages/profile/profile" });
    }, 1500);
    return;
  }
  uni.switchTab({
    url: "/pages/exchange/exchange"
  });
}
function isHtmlContent(text) {
  return /<[^>]+>/.test(text);
}
function previewImage(index) {
  if (!product.value?.imagesList?.length)
    return;
  uni.previewImage({
    current: index,
    urls: product.value.imagesList
  });
}
function getMediaUrl(media) {
  if (!media)
    return "";
  if (typeof media === "string") {
    return media.startsWith("http") ? media : `${BASE_URL}${media}`;
  }
  const url = media.url || media.formats?.thumbnail?.url || "";
  if (!url)
    return "";
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}
async function loadProduct() {
  if (!productId.value) {
    error.value = true;
    loading.value = false;
    return;
  }
  try {
    const res = await getPointProductDetail(productId.value);
    const p = res?.data || res;
    if (!p) {
      error.value = true;
      return;
    }
    product.value = {
      id: p.id,
      documentId: p.documentId,
      name: p.name || "",
      subtitle: p.subtitle || "",
      description: p.description || "",
      detail: p.detail || "",
      pointsCost: p.pointsCost || 0,
      originalPrice: p.originalPrice || 0,
      stock: p.stock ?? 0,
      deliveryType: p.deliveryType || "express",
      category: p.category || "",
      coverImageUrl: getMediaUrl(p.coverImage),
      imagesList: (p.images || []).map((img) => getMediaUrl(img)),
      maxPerUser: p.maxPerUser || 0,
      salesMode: p.salesMode || "points_only",
      price: parseFloat(p.price) || 0,
      channelId: p.channel?.documentId || p.channelId || "",
      allowCrossChannel: p.allowCrossChannel || false,
      allowGlobalPoints: p.allowGlobalPoints !== false
    };
    setupPageShare({
      title: p.name || undefined,
      desc: p.subtitle || p.description || undefined,
      imgUrl: product.value.coverImageUrl || undefined,
    })
    if (validateLogin()) {
      try {
        const balanceRes = await getPointBalance();
        pointsBalance.value = balanceRes?.balance ?? 0;
      } catch (e) {
      }
    }
  } catch (e) {
    console.error("[exchange-detail] \u52A0\u8F7D\u5546\u54C1\u5931\u8D25:", e);
    error.value = true;
  } finally {
    loading.value = false;
  }
}
onLoad((options) => {
  productId.value = options?.id || options?.documentId || "";
  loadProduct();
});
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

// 导航栏
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
  height: 88rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-back, .nav-share {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #333;
}

.share-icon {
  font-size: 32rpx;
}

.nav-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

// 加载/错误状态
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
  color: #999;
  font-size: 28rpx;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.error-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 30rpx;
}

.error-btn {
  padding: 16rpx 60rpx;
  background: #667eea;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
}

// 商品图片
.product-image-section {
  position: relative;
  width: 100%;
  height: 600rpx;
  background: #f0f0f0;
  overflow: hidden;
}

.product-cover {
  width: 100%;
  height: 100%;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120rpx;
}

.exchange-badge {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  background: #FF6B00;
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
  padding: 8rpx 20rpx;
  border-radius: 6rpx;
}

// 价格区域
.price-section {
  background: #fff;
  padding: 30rpx;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 20rpx;
}

.price-main {
  font-size: 40rpx;
  font-weight: bold;
  color: #FF4444;
}

.price-original {
  font-size: 26rpx;
  color: #999;
  text-decoration: line-through;
}

.product-stock {
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

// 商品名称
.info-section {
  background: #fff;
  padding: 30rpx;
  margin-top: 20rpx;
}

.product-name {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.5;
}

.product-subtitle {
  font-size: 26rpx;
  color: #666;
  margin-top: 12rpx;
  line-height: 1.5;
}

// 标签
.tags-section {
  background: #fff;
  padding: 0 30rpx 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.tag {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 6rpx;
}

.tag.delivery {
  background: #e8f0fe;
  color: #667eea;
}

.tag.category {
  background: #f0f0f0;
  color: #666;
}

.tag.cross-channel {
  background: #e8f5e9;
  color: #4caf50;
}

.tag.channel-only {
  background: #fff3e0;
  color: #ff9800;
}

// 描述区域
.desc-section {
  background: #fff;
  padding: 30rpx;
  margin-top: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
  display: block;
}

.desc-text {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
}

.rich-detail {
  font-size: 28rpx;
  color: #555;
  line-height: 1.8;
}

// 图片列表
.images-section {
  background: #fff;
  padding: 30rpx;
  margin-top: 20rpx;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.detail-image {
  width: 100%;
  border-radius: 12rpx;
}

// 底部操作栏
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  gap: 20rpx;
  z-index: 100;
}

.share-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 100%;
}

.action-icon {
  font-size: 36rpx;
}

.action-text {
  font-size: 20rpx;
  color: #666;
  margin-top: 4rpx;
}

.exchange-action {
  flex: 1;
  height: 72rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
}
</style>
