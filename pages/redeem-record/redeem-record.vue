<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="back-btn" @click="goBack">←</text>
        <text class="header-title">兑换记录</text>
      </view>
    </view>

    <view class="filter-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['filter-tab', { active: activeTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="record-list">
      <view v-for="record in records" :key="record.id ?? record.documentId" class="record-item" @click="onRecordClick(record)">
        <view class="record-icon">
          <text>{{ record.deliveryType === 'self_pickup' ? '📍' : '📦' }}</text>
        </view>
        <view class="record-info">
          <text class="record-name">{{ record.itemName }}</text>
          <text class="record-points">-{{ record.totalCost ?? record.pointsCost }}积分 x{{ record.quantity ?? 1 }}</text>
          <text class="record-delivery">{{ record.deliveryType === 'self_pickup' ? '到店自提' : '快递配送' }}</text>
          <view v-if="record.pickupLocationName" class="record-pickup-location"><text>自提点: {{ record.pickupLocationName }}</text></view>
          <view v-if="record.priceAmount > 0" class="record-price"><text>到店付: ¥{{ record.priceAmount }}</text></view>
          <!-- 兑换码提示 -->
          <view v-if="record.pickupCode && (record.status === 'approved' || record.status === 'pending')" class="record-pickup-hint">
            <text>点击查看兑换码</text>
          </view>
          <!-- 物流信息 -->
          <view v-if="record.trackingNumber" class="record-express">
            <text>{{ record.expressCompany }}: {{ record.trackingNumber }}</text>
          </view>
          <!-- 收货信息 -->
          <view v-if="record.receiverName" class="record-receiver">
            <text>{{ record.receiverName }} {{ record.receiverPhone }}</text>
          </view>
          <text class="record-time">{{ formatTime(record.createdAt) }}</text>
        </view>
        <view :class="['record-status', record.status]">
          <text>{{ getStatusText(record.status) }}</text>
        </view>
      </view>
    </view>

    <view v-if="records.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">📦</text>
      <text class="empty-text">暂无兑换记录</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
    <view v-else-if="hasMore" class="load-more" @click="loadMore"><text>加载更多</text></view>
    <view v-else-if="records.length > 0" class="no-more"><text>没有更多了</text></view>

    <!-- 兑换码弹窗 -->
    <view class="pickup-modal-mask" v-if="showPickupModal" @click="closePickupModal">
      <view class="pickup-modal" @click.stop>
        <view class="pickup-modal-header">
          <text class="pickup-modal-title">兑换码</text>
          <text class="pickup-modal-close" @click="closePickupModal">✕</text>
        </view>
        <view class="pickup-modal-body">
          <text class="pickup-product-name">{{ currentRecord?.itemName }}</text>
          <view class="pickup-qrcode-wrapper">
            <!-- 使用图片显示二维码 -->
            <image :src="qrcodeUrl" class="pickup-qrcode-img" mode="aspectFit" />
          </view>
          <view class="pickup-code-display">
            <text class="pickup-code-label">兑换码</text>
            <text class="pickup-code-value">{{ currentRecord?.pickupCode }}</text>
          </view>
          <text class="pickup-tip">请向工作人员出示此二维码或兑换码</text>
          <view v-if="currentRecord?.deliveryType === 'self_pickup'" class="pickup-location-info">
            <text class="pickup-location-label">自提点</text>
            <text class="pickup-location-value">{{ currentRecord.pickupLocationName ?? '到店自提' }}</text>
          </view>
          <view v-if="currentRecord?.priceAmount > 0" class="pickup-price-info">
            <text class="pickup-price-label">到店支付</text>
            <text class="pickup-price-value">¥{{ currentRecord.priceAmount }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getRedemptionRecordList } from '../../services/api'
import { validateLogin } from '../../utils/auth'
import UQRCode from 'uqrcodejs'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

const records = ref<any[]>([])
const activeTab = ref('all')
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const hasMore = ref(true)
const siteConfig = getStoredAuthConfig()

const showPickupModal = ref(false)
const currentRecord = ref<any>(null)
const qrcodeUrl = ref('')

const tabs = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
]

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    shipped: '已发货',
    completed: '已完成',
    rejected: '已拒绝',
    cancelled: '已取消',
  }
  return map[status] ?? status
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function switchTab(tab: string) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  page.value = 1
  records.value = []
  hasMore.value = true
  loadRecords()
}

async function loadRecords(append = false) {
  if (loading.value) return
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: 20 }
    if (activeTab.value !== 'all') params.status = activeTab.value
    const res = await getRedemptionRecordList(params)
    const data = (res as any)?.data ?? {}
    const list = data.records ?? data.list ?? []
    total.value = data.total ?? 0
    if (append) {
      records.value = [...records.value, ...list.map((r: any) => ({
        ...r,
        pickupLocationName: r.pickupLocation?.name ?? r.pickupLocationName ?? '',
      }))]
    } else {
      records.value = list.map((r: any) => ({
        ...r,
        pickupLocationName: r.pickupLocation?.name ?? r.pickupLocationName ?? '',
      }))
    }
    hasMore.value = records.value.length < total.value
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value++
  loadRecords(true)
}

function onRecordClick(record: any) {
  if (record.pickupCode && (record.status === 'approved' || record.status === 'pending')) {
    currentRecord.value = record
    showPickupModal.value = true
    nextTick(() => {
      generateQrcode(record.pickupCode)
    })
  }
}

function generateQrcode(code: string) {
  // #ifdef H5
  // 在内存中创建canvas生成二维码
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('无法获取canvas上下文')
    return
  }

  const qr = new UQRCode()
  qr.data = code
  qr.size = 200
  qr.make()

  // 使用 getDrawModules 方法获取绘制模块
  const drawModules = qr.getDrawModules()

  // 清空画布
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 200, 200)

  // 遍历绘制模块绘制二维码
  for (let i = 0; i < drawModules.length; i++) {
    const drawModule = drawModules[i]
    if (drawModule.type === 'tile') {
      ctx.fillStyle = drawModule.color ?? '#000000'
      ctx.fillRect(drawModule.x, drawModule.y, drawModule.width, drawModule.height)
    }
  }

  // 转换为base64图片URL
  qrcodeUrl.value = canvas.toDataURL('image/png')
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在H5端查看兑换码', icon: 'none' })
  // #endif
}

function closePickupModal() {
  showPickupModal.value = false
  currentRecord.value = null
  qrcodeUrl.value = ''
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/profile' })
  }
}

function checkLoginStatus() {
  if (!validateLogin()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/login' }) }, 1500)
    return false
  }
  return true
}

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '兑换记录' })
  // #endif
  if (checkLoginStatus()) loadRecords()
  setupPageShare({ title: '兑换记录' })
})
onShow(() => { if (checkLoginStatus()) loadRecords() })
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

.filter-tabs {
  display: flex;
  padding: 20rpx 30rpx;
  gap: 15rpx;
}

.filter-tab {
  flex: 1; text-align: center; padding: 15rpx;
  background: #fff; border-radius: 25rpx;
  font-size: 26rpx; color: #666;
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.record-list { padding: 0 30rpx; }

.record-item {
  display: flex;
  background: #fff; padding: 25rpx;
  border-radius: 16rpx; margin-bottom: 15rpx;
}

.record-icon {
  width: 80rpx; height: 80rpx;
  background: #f5f5f5; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; flex-shrink: 0;
}

.record-info { flex: 1; padding: 0 20rpx; }
.record-name { display: block; font-size: 30rpx; font-weight: 500; color: #333; }
.record-points { display: block; font-size: 26rpx; color: #f5576c; margin-top: 6rpx; }
.record-delivery { display: block; font-size: 24rpx; color: #667eea; margin-top: 4rpx; }
.record-pickup-hint { margin-top: 6rpx; }
.record-pickup-hint text { font-size: 22rpx; color: #fa8c16; background: #fff7e6; padding: 4rpx 12rpx; border-radius: 8rpx; }
.record-express { font-size: 22rpx; color: #1890ff; margin-top: 4rpx; }
.record-receiver { font-size: 22rpx; color: #666; margin-top: 4rpx; }
.record-time { display: block; font-size: 22rpx; color: #999; margin-top: 6rpx; }

.record-status {
  padding: 10rpx 20rpx; border-radius: 20rpx;
  font-size: 24rpx; white-space: nowrap; align-self: flex-start;
  &.pending { background: #fff7e6; color: #fa8c16; }
  &.approved { background: #e6f7ff; color: #1890ff; }
  &.shipped { background: #f0f4ff; color: #667eea; }
  &.completed { background: #f6ffed; color: #52c41a; }
  &.rejected { background: #ffebee; color: #ff4d4f; }
  &.cancelled { background: #f5f5f5; color: #999; }
}

.empty-state { padding: 100rpx 30rpx; text-align: center; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }

.loading-more, .load-more, .no-more {
  text-align: center; padding: 30rpx; font-size: 26rpx; color: #999;
}
.load-more { color: #667eea; }

/* 提货码弹窗 */
.pickup-modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}

.pickup-modal {
  width: 80%; background: #fff; border-radius: 24rpx; overflow: hidden;
}

.pickup-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 30rpx; border-bottom: 1rpx solid #f0f0f0;
}

.pickup-modal-title { font-size: 34rpx; font-weight: bold; color: #333; }
.pickup-modal-close { font-size: 36rpx; color: #999; padding: 10rpx; }

.pickup-modal-body {
  padding: 40rpx; display: flex; flex-direction: column; align-items: center;
}

.pickup-product-name { font-size: 30rpx; color: #333; font-weight: 500; margin-bottom: 30rpx; }

.pickup-qrcode-wrapper {
  width: 400rpx; height: 400rpx;
  background: #fff; border: 2rpx solid #e8e8e8; border-radius: 16rpx;
  display: flex; align-items: center; justify-content: center;
  padding: 20rpx;
}

.pickup-qrcode-img { width: 360rpx; height: 360rpx; }

.pickup-code-display {
  margin-top: 30rpx; text-align: center;
}

.pickup-code-label { font-size: 24rpx; color: #999; display: block; }

.pickup-code-value {
  font-size: 48rpx; font-weight: bold; color: #667eea;
  letter-spacing: 8rpx; margin-top: 10rpx; display: block;
}

.pickup-tip { font-size: 24rpx; color: #999; margin-top: 20rpx; text-align: center; }

.record-pickup-location { font-size: 22rpx; color: #667eea; margin-top: 4rpx; }
.record-price { font-size: 22rpx; color: #fa8c16; margin-top: 4rpx; }
.pickup-location-info, .pickup-price-info { display: flex; justify-content: space-between; margin-top: 16rpx; width: 100%; }
.pickup-location-label, .pickup-price-label { font-size: 24rpx; color: #999; }
.pickup-location-value { font-size: 24rpx; color: #333; }
.pickup-price-value { font-size: 28rpx; font-weight: bold; color: #f5576c; }
</style>
