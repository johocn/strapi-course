<template>
  <view class="guide-container">
    <view class="guide-header">
      <text class="guide-title">欢迎使用{{ siteConfig?.siteName ?? '学习平台' }}</text>
      <text class="guide-subtitle">让我们开始您的学习之旅</text>
    </view>

    <swiper 
      class="guide-swiper" 
      :current="currentStep"
      @change="onSwiperChange"
      indicator-dots
      autoplay
      circular
    >
      <swiper-item>
        <view class="guide-step">
          <view class="step-icon">📚</view>
          <text class="step-title">海量优质课程</text>
          <text class="step-desc">涵盖语言、技术、艺术等多个领域，满足您的学习需求</text>
        </view>
      </swiper-item>
      
      <swiper-item>
        <view class="guide-step">
          <view class="step-icon">🎬</view>
          <text class="step-title">视频学习</text>
          <text class="step-desc">观看视频课程，记录学习进度，随时随地学习</text>
        </view>
      </swiper-item>
      
      <swiper-item>
        <view class="guide-step">
          <view class="step-icon">📝</view>
          <text class="step-title">答题赢积分</text>
          <text class="step-desc">完成学习后答题，正确率达标即可获得积分奖励</text>
        </view>
      </swiper-item>
      
      <swiper-item>
        <view class="guide-step">
          <view class="step-icon">🎁</view>
          <text class="step-title">积分兑换</text>
          <text class="step-desc">使用积分兑换精美礼品，让学习更有价值</text>
        </view>
      </swiper-item>
    </swiper>

    <view class="guide-actions">
      <view class="skip-btn" @click="skipGuide">
        <text>跳过引导</text>
      </view>
      <view class="start-btn" @click="startLearning">
        <text>开始学习</text>
      </view>
    </view>

    <view class="guide-tips">
      <text class="tip-item">✓ 每日答题上限3次</text>
      <text class="tip-item">✓ 答题正确率≥60%得积分</text>
      <text class="tip-item">✓ 邀请好友双方各得50积分</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

const siteConfig = getStoredAuthConfig()

const currentStep = ref(0)

function onSwiperChange(e: any) {
  currentStep.value = e.detail.current
}

function skipGuide() {
  // 标记已完成引导
  uni.setStorageSync('guideCompleted', 'true')
  uni.switchTab({ url: '/pages/index/index' })
}

function startLearning() {
  // 标记已完成引导
  uni.setStorageSync('guideCompleted', 'true')
  uni.switchTab({ url: '/pages/index/index' })
}

onShow(() => {
  setupPageShare({ title: '新手指引' })
})
</script>

<style lang="scss" scoped>
.guide-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx;
  display: flex;
  flex-direction: column;
}

.guide-header {
  text-align: center;
  margin-bottom: 40rpx;
}

.guide-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.guide-subtitle {
  display: block;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.guide-swiper {
  height: 500rpx;
  margin-bottom: 40rpx;
}

.guide-step {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.step-icon {
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.step-title {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.step-desc {
  display: block;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  line-height: 1.6;
}

.guide-actions {
  display: flex;
  gap: 30rpx;
  margin-bottom: 40rpx;
}

.skip-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 40rpx;
}

.skip-btn text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.start-btn {
  flex: 2;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 40rpx;
}

.start-btn text {
  font-size: 30rpx;
  font-weight: bold;
  color: #667eea;
}

.guide-tips {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
  padding: 30rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
}

.tip-item {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
}
</style>