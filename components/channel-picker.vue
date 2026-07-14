<template>
  <view v-if="visible" class="channel-picker-overlay" @click="onCancel">
    <view class="channel-picker-modal" @click.stop>
      <view class="picker-header">
        <text class="picker-title">选择积分充值渠道</text>
        <view class="picker-close" @click="onCancel">✕</view>
      </view>
      <view v-if="quizInfo" class="picker-info">
        <text>答对 {{ quizInfo.successCount }}/{{ quizInfo.totalCount }} 题，可获得 {{ quizInfo.earnedPoints }} 积分</text>
      </view>
      <scroll-view scroll-y class="picker-list">
        <view
          v-for="ch in channels"
          :key="ch.documentId"
          :class="['picker-option', { selected: selectedDocId === ch.documentId }]"
          @click="selectChannel(ch.documentId)"
        >
          <text class="picker-radio"></text>
          <text class="picker-option-name">{{ ch.name }}</text>
          <text v-if="ch.documentId === defaultDocId && defaultDocId" class="picker-default-tag">默认</text>
        </view>
      </scroll-view>
      <view class="picker-footer">
        <view class="picker-btn picker-cancel" @click="onCancel">
          <text>取消</text>
        </view>
        <view
          :class="['picker-btn', 'picker-confirm', { disabled: !selectedDocId }]"
          @click="onConfirm"
        >
          <text>确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ChannelItem {
  documentId: string
  name: string
  id?: number
}

interface QuizInfo {
  successCount: number
  totalCount: number
  earnedPoints: number
}

const props = defineProps<{
  visible: boolean
  channels: ChannelItem[]
  defaultDocId?: string
  quizInfo?: QuizInfo
}>()

const emit = defineEmits<{
  'update:visible': [val: boolean]
  confirm: [selectedDocId: string]
  cancel: []
}>()

const selectedDocId = ref<string | null>(null)

watch(() => props.visible, (val) => {
  if (val) {
    selectedDocId.value = props.defaultDocId || null
  }
})

function selectChannel(docId: string) {
  selectedDocId.value = docId
}

function onCancel() {
  emit('cancel')
  emit('update:visible', false)
}

function onConfirm() {
  if (!selectedDocId.value) {
    uni.showToast({ title: '请选择积分充值渠道', icon: 'none' })
    return
  }
  emit('confirm', selectedDocId.value)
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.channel-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.channel-picker-modal {
  width: 90%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  flex-shrink: 0;
}

.picker-title {
  font-size: 32rpx;
  font-weight: bold;
}

.picker-close {
  font-size: 36rpx;
  color: #999;
  padding: 10rpx;
}

.picker-info {
  padding: 20rpx 30rpx;
  background: #f8f9ff;
  font-size: 26rpx;
  color: #666;
  flex-shrink: 0;
}

.picker-list {
  flex: 1;
  max-height: 50vh;
}

.picker-option {
  display: flex;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &.selected {
    .picker-radio {
      background: #667eea;
      border-color: #667eea;

      &::after {
        content: '✓';
        color: #fff;
        font-size: 24rpx;
      }
    }
  }
}

.picker-radio {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #d9d9d9;
  border-radius: 50%;
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
}

.picker-option-name {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.picker-default-tag {
  font-size: 22rpx;
  color: #667eea;
  background: #f8f9ff;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin-left: 10rpx;
}

.picker-footer {
  display: flex;
  border-top: 1rpx solid #f0f0f0;
  flex-shrink: 0;
}

.picker-btn {
  flex: 1;
  padding: 24rpx;
  text-align: center;
  font-size: 30rpx;
}

.picker-cancel {
  color: #666;
  border-right: 1rpx solid #f0f0f0;
}

.picker-confirm {
  color: #fff;
  background: #667eea;
  font-weight: bold;

  &.disabled {
    background: #c5cad3;
  }
}
</style>
