<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="back-btn" @click="goBack">←</text>
        <text class="header-title">自提点详情</text>
      </view>
    </view>

    <view v-if="detail" class="detail-content">
      <view class="detail-cover">
        <image v-if="detail.coverUrl" class="cover-img" :src="detail.coverUrl" mode="aspectFill" />
        <view v-else class="cover-placeholder">
          <text>📍</text>
        </view>
      </view>

      <view class="detail-card">
        <text class="detail-name">{{ detail.name }}</text>

        <view class="detail-row" @click="onNavigate">
          <view class="row-left">
            <text class="row-label">📍 地址</text>
            <text class="row-value">{{ detail.address }}</text>
          </view>
          <text class="row-action">导航</text>
        </view>

        <view class="detail-row" @click="onCall">
          <view class="row-left">
            <text class="row-label">📞 电话</text>
            <text class="row-value">{{ detail.phone || '暂无' }}</text>
          </view>
          <text class="row-action">拨打</text>
        </view>

        <view class="detail-row">
          <view class="row-left">
            <text class="row-label">🕐 营业时间</text>
            <text class="row-value">{{ detail.businessHours || '暂无' }}</text>
          </view>
        </view>
      </view>

      <view v-if="detail.licenseUrl" class="detail-card">
        <text class="card-title">营业执照</text>
        <image
          class="license-img"
          :src="detail.licenseUrl"
          mode="widthFix"
          @click="onPreviewLicense"
        />
      </view>

      <view v-if="detail.latitude && detail.longitude" class="detail-card">
        <text class="card-title">位置信息</text>
        <map
          class="location-map"
          :latitude="detail.latitude"
          :longitude="detail.longitude"
          :markers="markers"
          :scale="15"
        />
      </view>
    </view>

    <view v-if="!detail && !loading" class="empty-state">
      <text class="empty-icon">📍</text>
      <text class="empty-text">未找到自提点信息</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getPickupLocationDetail } from '../../services/api'
import { BASE_URL } from '../../utils/env'

const id = ref('')
const detail = ref<any>(null)
const loading = ref(false)

const markers = computed(() => {
  if (!detail.value?.latitude || !detail.value?.longitude) return []
  return [{
    id: 1,
    latitude: detail.value.latitude,
    longitude: detail.value.longitude,
    title: detail.value.name,
    width: 30,
    height: 30
  }]
})

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

async function loadDetail() {
  loading.value = true
  try {
    const res = await getPickupLocationDetail(id.value)
    const raw = (res as any)?.data || res
    detail.value = {
      ...raw,
      coverUrl: getMediaUrl(raw.coverImage),
      licenseUrl: getMediaUrl(raw.businessLicense),
    }
  } catch (e) {
    console.error('加载自提点详情失败', e)
  } finally {
    loading.value = false
  }
}

function getMediaUrl(media: any) {
  if (!media) return ''
  if (typeof media === 'string') return media
  const url = media.url || media.formats?.thumbnail?.url || ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

function onNavigate() {
  if (!detail.value?.latitude || !detail.value?.longitude) {
    uni.showToast({ title: '暂无位置信息', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: detail.value.latitude,
    longitude: detail.value.longitude,
    name: detail.value.name,
    address: detail.value.address
  })
}

function onCall() {
  if (!detail.value?.phone) {
    uni.showToast({ title: '暂无联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: detail.value.phone })
}

function onPreviewLicense() {
  if (!detail.value?.licenseUrl) return
  uni.previewImage({
    urls: [detail.value.licenseUrl],
    current: detail.value.licenseUrl
  })
}

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  id.value = page?.options?.id || page?.$page?.options?.id || ''
  if (id.value) loadDetail()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  position: relative;
  padding: 40rpx 30rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 200rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative; z-index: 1;
  display: flex; align-items: center;
}

.back-btn { color: #fff; font-size: 28rpx; margin-right: 20rpx; }
.header-title { font-size: 36rpx; font-weight: bold; color: #fff; }

.detail-content { padding: 0 30rpx; }

.detail-cover {
  width: 100%;
  height: 360rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: #f5f5f5;
  margin-bottom: 20rpx;
}

.cover-img { width: 100%; height: 100%; }

.cover-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 80rpx;
}

.detail-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.detail-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child { border-bottom: none; }
}

.row-left { flex: 1; overflow: hidden; }

.row-label {
  font-size: 26rpx;
  color: #999;
  display: block;
  margin-bottom: 4rpx;
}

.row-value {
  font-size: 28rpx;
  color: #333;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-action {
  font-size: 26rpx;
  color: #667eea;
  flex-shrink: 0;
  padding: 8rpx 20rpx;
  background: #f0f4ff;
  border-radius: 20rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.license-img {
  width: 100%;
  border-radius: 12rpx;
}

.location-map {
  width: 100%;
  height: 400rpx;
  border-radius: 12rpx;
}

.empty-state { padding: 100rpx 30rpx; text-align: center; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }

.loading-more { text-align: center; padding: 30rpx; font-size: 26rpx; color: #999; }
</style>
