<template>
  <view class="page-container">
    <view class="customer-list">
      <view
        v-for="item in customers"
        :key="item.id"
        class="customer-item"
        @click="goDetail(item)"
      >
        <view class="item-top">
          <view class="item-info">
            <text class="item-name">{{ item.username || '未命名' }}</text>
            <view
              class="segment-badge"
              :style="{ background: segmentColor(item.profile?.segment), color: '#fff' }"
            >
              {{ item.profile?.segment ?? 'C' }}
            </view>
          </view>
          <text class="item-score">综合分 {{ item.profile?.segmentScore ?? 0 }}</text>
        </view>
        <text v-if="item.email" class="item-contact">{{ item.email }}</text>
        <text v-if="item.mobile" class="item-contact">{{ item.mobile }}</text>
        <text v-if="item.profile?.segmentReason" class="item-reason">{{ item.profile.segmentReason }}</text>
      </view>
    </view>

    <view v-if="customers.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">👥</text>
      <text class="empty-text">暂无下线客户</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { partnerApi } from '../../services/api'
import { getToken } from '../../utils/storage'

const customers = ref<any[]>([])
const loading = ref(false)

function segmentColor(segment?: string): string {
  const map: Record<string, string> = { S: '#e74c3c', A: '#e67e22', B: '#3498db', C: '#95a5a6' }
  return map[segment || 'C'] || '#95a5a6'
}

function goDetail(item: any) {
  uni.navigateTo({ url: `/pages/partner/customer-detail?id=${item.id}` })
}

async function loadCustomers() {
  loading.value = true
  try {
    const res: any = await partnerApi.myCustomers()
    const list = res?.data ?? res
    customers.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载下线客户失败', e)
  } finally {
    loading.value = false
  }
}

onShow(() => {
  if (getToken()) loadCustomers()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.customer-item {
  background: #fff;
  padding: 28rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.segment-badge {
  flex-shrink: 0;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;
}

.item-score {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #666;
}

.item-contact {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 12rpx;
}

.item-reason {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

.empty-state {
  padding: 120rpx 30rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}

.loading-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}
</style>
