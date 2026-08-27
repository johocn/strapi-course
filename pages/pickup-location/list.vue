<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="back-btn" @click="goBack">←</text>
        <text class="header-title">选择自提点</text>
      </view>
    </view>

    <view class="location-list">
      <view
        v-for="item in locations"
        :key="item.documentId || item.id"
        :class="['location-item', { selected: selectedId === (item.documentId || item.id) }]"
        @click="onSelect(item)"
      >
        <view class="item-top">
          <view class="item-cover">
            <image v-if="item.coverUrl" class="cover-img" :src="item.coverUrl" mode="aspectFill" />
            <text v-else class="cover-placeholder">📍</text>
          </view>
          <view class="item-info">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-address">{{ item.address }}</text>
            <view class="item-meta">
              <text v-if="item.distance !== undefined" class="item-distance">{{ item.distance }}</text>
              <text v-if="item.businessHours" class="item-hours">营业时间：{{ item.businessHours }}</text>
            </view>
          </view>
          <view class="item-actions">
            <text class="action-icon" @click.stop="onCall(item)">📞</text>
            <text class="action-icon" @click.stop="onNavigate(item)">🧭</text>
          </view>
        </view>
        <view v-if="selectedId === (item.documentId || item.id)" class="item-check">✓ 已选择</view>
      </view>
    </view>

    <view v-if="locations.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">📍</text>
      <text class="empty-text">暂无自提点</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>

    <view class="bottom-bar">
      <view :class="['confirm-btn', { disabled: !selectedId }]" @click="onConfirm">
        <text>确认选择</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPickupLocationList } from '../../services/api'
import { BASE_URL } from '../../utils/env'
import { setupPageShare } from '../../utils/share'

const channelId = ref('')
const locations = ref<any[]>([])
const selectedId = ref<string | null>(null)
const selectedLocation = ref<any>(null)
const loading = ref(false)
const userLat = ref(0)
const userLng = ref(0)

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/index/index' })
  }
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

function getMediaUrl(media: any) {
  if (!media) return ''
  if (typeof media === 'string') return media
  const url = media.url || media.formats?.thumbnail?.url || ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

async function loadLocations() {
  loading.value = true
  try {
    const res = await getPickupLocationList({ channelId: channelId.value })
    const data = (res as any)?.data || {}
    let list: any[] = data.records || data.list || []
    if (!Array.isArray(list)) list = Array.isArray(data) ? data : []

    if (userLat.value && userLng.value) {
      list = list.map((item: any) => {
        if (item.latitude && item.longitude) {
          const dist = calcDistance(userLat.value, userLng.value, item.latitude, item.longitude)
          return { ...item, _distKm: dist, distance: formatDistance(dist), coverUrl: getMediaUrl(item.coverImage) }
        }
        return { ...item, coverUrl: getMediaUrl(item.coverImage) }
      }).sort((a: any, b: any) => (a._distKm ?? Infinity) - (b._distKm ?? Infinity))
    } else {
      list = list.map((item: any) => ({ ...item, coverUrl: getMediaUrl(item.coverImage) }))
    }

    locations.value = list
  } catch (e) {
    console.error('加载自提点失败', e)
  } finally {
    loading.value = false
  }
}

function getUserLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      userLat.value = res.latitude
      userLng.value = res.longitude
      loadLocations()
    },
    fail: () => {
      loadLocations()
    }
  })
}

function onSelect(item: any) {
  const id = item.documentId || item.id
  selectedId.value = id
  selectedLocation.value = item
}

function onConfirm() {
  if (!selectedLocation.value) return
  uni.$emit('selectPickupLocation', selectedLocation.value)
  uni.navigateBack()
}

function onCall(item: any) {
  if (!item.phone) {
    uni.showToast({ title: '暂无联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: item.phone })
}

function onNavigate(item: any) {
  if (!item.latitude || !item.longitude) {
    uni.showToast({ title: '暂无位置信息', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: item.latitude,
    longitude: item.longitude,
    name: item.name,
    address: item.address
  })
}

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  channelId.value = page?.options?.channelId || page?.$page?.options?.channelId || ''
  getUserLocation()
  setupPageShare({ title: '自提点' })
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
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

.location-list { padding: 0 30rpx; }

.location-item {
  background: #fff;
  padding: 25rpx;
  border-radius: 16rpx;
  margin-bottom: 15rpx;
  border: 2rpx solid transparent;
  transition: border-color 0.2s;

  &.selected {
    border-color: #667eea;
  }
}

.item-top {
  display: flex;
  align-items: flex-start;
}

.item-cover {
  width: 120rpx; height: 120rpx;
  background: #f5f5f5; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}

.cover-img { width: 100%; height: 100%; }
.cover-placeholder { font-size: 48rpx; }

.item-info {
  flex: 1;
  padding: 0 20rpx;
  overflow: hidden;
}

.item-name {
  display: block;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-address {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  margin-top: 8rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.item-distance {
  font-size: 22rpx;
  color: #667eea;
  background: #f0f4ff;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.item-hours {
  font-size: 22rpx;
  color: #999;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex-shrink: 0;
}

.action-icon {
  font-size: 36rpx;
  padding: 8rpx;
}

.item-check {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #667eea;
  text-align: right;
}

.empty-state { padding: 100rpx 30rpx; text-align: center; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }

.loading-more { text-align: center; padding: 30rpx; font-size: 26rpx; color: #999; }

.bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.confirm-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  text-align: center;
  padding: 24rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;

  &.disabled {
    opacity: 0.5;
  }
}
</style>
