<template>
  <view class="page-container">
    <view v-if="activity" class="detail-wrap">
      <view class="card">
        <view class="card-head">
          <text class="title">{{ activity.title }}</text>
          <view v-if="activity.status" :class="['status-tag', `status-${activity.status}`]">
            <text>{{ statusText(activity.status) }}</text>
          </view>
        </view>

        <view class="info-row">
          <text class="info-label">时间</text>
          <text class="info-value">{{ formatTime(activity.startTime) }} ~ {{ formatTime(activity.endTime) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">场地</text>
          <text class="info-value">{{ activity.venueName || '待定场地' }}</text>
        </view>
        <view v-if="activity.capacity" class="info-row">
          <text class="info-label">名额</text>
          <text class="info-value">{{ usedCapacity }}/{{ activity.capacity }} 已报名</text>
        </view>

        <view v-if="activity.description" class="desc">
          <text class="desc-title">活动介绍</text>
          <text class="desc-content">{{ activity.description }}</text>
        </view>
      </view>

      <!-- 分享海报入口 -->
      <view class="share-entry" @click="showSharePoster = true">
        <text>分享海报</text>
      </view>

      <!-- 报名成功后的到场二维码（worker_scan 模式） -->
      <view v-if="signedUp && canWorkerScan" class="card qr-card">
        <text class="qr-title">到场二维码</text>
        <text class="qr-tip">请向现场工作人员出示此二维码核销</text>
        <view class="qr-box">
          <image v-if="qrcodeUrl" :src="qrcodeUrl" class="qr-img" mode="aspectFit" />
          <text v-else class="qr-placeholder">二维码生成中...</text>
        </view>
      </view>

      <!-- 操作区 -->
      <view v-if="!signedUp && !waitlisted && activity.status === 'signup_open'" class="action-bar">
        <view class="action-btn primary" @click="onSignup">
          <text>{{ isFull ? '立即候补' : '立即报名' }}</text>
        </view>
      </view>

      <view v-else-if="waitlisted" class="action-bar">
        <view class="action-btn waiting"><text>候补中 #{{ waitlistPosition }}</text></view>
        <view class="action-btn normal" @click="onCancel"><text>取消候补</text></view>
      </view>

      <view v-if="signedUp" class="action-bar">
        <view v-if="canSelf" class="action-btn primary" @click="onCheckin">
          <text>到场签到</text>
        </view>
        <view v-if="canCancel" class="action-btn ghost" @click="onCancel">
          <text>取消报名</text>
        </view>
      </view>
    </view>

    <view v-if="!activity && loading" class="loading-state"><text>加载中...</text></view>
    <view v-if="!activity && !loading" class="loading-state"><text>活动不存在或已下架</text></view>

    <!-- 分享海报（复用通用 share-poster 组件） -->
    <share-poster
      :visible="showSharePoster"
      @close="showSharePoster = false"
      :config="{
        templateCode: 'activity_share',
        title: activity?.title,
        desc: activity?.description,
        pagePath: `pages/activity/detail?id=${id}`,
        variables: {
          title: activity?.title || '',
          activity_time: activity?.startTime
            ? `活动时间 · ${formatTime(activity.startTime)} ~ ${formatTime(activity.endTime)}`
            : '活动时间 · 待定',
          activity_venue: activity?.venueName ? `活动场所 · ${activity.venueName}` : '活动场所 · 待定'
        }
      }"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getActivityDetail,
  signupActivity,
  cancelActivity,
  checkinActivity,
  myActivities,
  getUserInfo,
} from '../../services/api'
import { getToken, getUser } from '../../utils/storage'
import UQRCode from 'uqrcodejs'
import SharePoster from '../../components/share-poster/share-poster.vue'

let id = ''
const activity = ref<any>(null)
const loading = ref(false)
const signedUp = ref(false)
const waitlisted = ref(false)
const waitlistPosition = ref(0)
const isFull = computed(() => (activity.value?.usedCapacity ?? 0) >= (activity.value?.capacity ?? 0))
const qrcodeUrl = ref('')
const showSharePoster = ref(false)

const canWorkerScan = computed(() => {
  const m = activity.value?.checkinMode
  return m === 'worker_scan' || m === 'both'
})

const canSelf = computed(() => {
  const m = activity.value?.checkinMode
  return m === 'self' || m === 'both'
})

const canCancel = computed(() => {
  const s = activity.value?.status
  return s === 'signup_open' || s === 'ongoing'
})

const usedCapacity = computed(() => activity.value?.usedCapacity ?? 0)

function statusText(status: string): string {
  const map: Record<string, string> = {
    draft: '未开放',
    signup_open: '报名中',
    ongoing: '进行中',
    ended: '已结束',
  }
  return map[status] ?? status ?? ''
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadActivity() {
  if (!id) return
  loading.value = true
  try {
    const res = await getActivityDetail(id)
    activity.value = res ?? null
  } catch (e) {
    console.error('加载活动详情失败', e)
  } finally {
    loading.value = false
  }
  restoreSignupState()
}

/** 解析用户数字 ID：优先取本地，若非整数则走接口 */
async function resolveUserId(): Promise<number> {
  const user = getUser()
  const storedId = user?.id
  const n = typeof storedId === 'number' ? storedId : Number(storedId)
  if (Number.isInteger(n)) return n
  const info = await getUserInfo()
  const idNum = typeof info?.id === 'number' ? info.id : Number(info?.id)
  return Number.isInteger(idNum) ? idNum : NaN
}

/** 生成到场二维码（内容格式 activity:{activityId}:{userId}） */
async function generateQrcode() {
  const userId = await resolveUserId()
  if (!Number.isInteger(userId)) {
    uni.showToast({ title: '无法获取用户信息，二维码生成失败', icon: 'none' })
    return
  }
  const code = `activity:${id}:${userId}`
  // #ifdef H5
  // 在内存中创建 canvas 生成二维码
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

  const drawModules = qr.getDrawModules()

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 200, 200)

  for (let i = 0; i < drawModules.length; i++) {
    const drawModule = drawModules[i]
    if (drawModule.type === 'tile') {
      ctx.fillStyle = drawModule.color ?? '#000000'
      ctx.fillRect(drawModule.x, drawModule.y, drawModule.width, drawModule.height)
    }
  }

  qrcodeUrl.value = canvas.toDataURL('image/png')
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在H5端查看二维码', icon: 'none' })
  // #endif
}

async function onSignup() {
  uni.showLoading({ title: '报名中...' })
  try {
    const result = await signupActivity(id)
    if ((result as any)?.ok) {
      if ((result as any)?.waitlisted) {
        waitlisted.value = true
        waitlistPosition.value = (result as any)?.position || 0
        uni.hideLoading()
        uni.showToast({ title: `已加入候补 #${waitlistPosition.value}`, icon: 'none' })
        return
      }
      signedUp.value = true
      waitlisted.value = false
      uni.hideLoading()
      uni.showToast({ title: '报名成功', icon: 'success' })
      nextTick(() => generateQrcode())
    } else {
      uni.hideLoading()
      if ((result as any)?.reason === 'already_signed_up') {
        signedUp.value = true
        uni.showToast({ title: '您已报名过', icon: 'none' })
        nextTick(() => generateQrcode())
      } else {
        uni.showToast({ title: '报名失败', icon: 'none' })
      }
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '报名失败', icon: 'none' })
  }
}

async function onCancel() {
  uni.showModal({
    title: '取消报名',
    content: '确定要取消本次报名吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await cancelActivity(id)
          if ((result as any)?.ok) {
            signedUp.value = false
            waitlisted.value = false
            waitlistPosition.value = 0
            qrcodeUrl.value = ''
            uni.showToast({ title: '已取消报名', icon: 'success' })
          } else {
            uni.showToast({ title: '取消失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    },
  })
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
      fail: (err) => reject(err),
    })
  })
}

function handleCheckinResult(result: any) {
  if (result?.ok) {
    const point = result.point
    if (point) {
      uni.showToast({ title: `已获得积分 +${point}`, icon: 'none' })
    } else {
      uni.showToast({ title: '签到成功', icon: 'success' })
    }
  } else {
    if (result?.reason === 'already_checked_in') {
      uni.showToast({ title: '您已签到过了', icon: 'none' })
    } else {
      uni.showToast({ title: '签到失败', icon: 'none' })
    }
  }
}

async function doCheckin() {
  uni.showLoading({ title: '签到中...' })
  try {
    let result: any
    if (activity.value?.geoEnforced) {
      const loc = await getLocation()
      result = await checkinActivity(id, { method: 'self', lat: loc.latitude, lng: loc.longitude })
    } else {
      result = await checkinActivity(id, { method: 'self' })
    }
    uni.hideLoading()
    handleCheckinResult(result)
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '签到失败', icon: 'none' })
  }
}

function onCheckin() {
  uni.showModal({
    title: '到场签到',
    content: '确认已到达现场并进行签到吗？',
    success: (res) => {
      if (res.confirm) doCheckin()
    },
  })
}

/** 恢复报名状态：若已登录，从我的报名记录判断本活动是否已报名 */
async function restoreSignupState() {
  if (!getToken()) return
  try {
    const list = (await myActivities()) as any
    const arr = Array.isArray(list) ? list : []
    const found = arr.find((r: any) => r?.activity?.documentId === id || r?.activity?.id === id)
    const st = found?.status
    waitlisted.value = st === 'waiting'
    signedUp.value = st === 'active'
    if (signedUp.value) nextTick(() => generateQrcode())
  } catch (e) {
    // 无需登录则跳过，登录跳转交给 request 内部逻辑
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  id = page?.options?.id || page?.$page?.options?.id || ''
  loadActivity()
})

onShow(() => {
  if (id && activity.value) restoreSignupState()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 160rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.status-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  white-space: nowrap;

  &.status-signup_open {
    background: #e6f7ff;
    color: #1890ff;
  }
  &.status-ongoing {
    background: #f6ffed;
    color: #52c41a;
  }
  &.status-ended {
    background: #f5f5f5;
    color: #999;
  }
  &.status-draft {
    background: #f0f0f0;
    color: #bbb;
  }
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
}

.info-label {
  width: 90rpx;
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
}

.desc {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.desc-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.desc-content {
  display: block;
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.qr-card {
  text-align: center;
}

.qr-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.qr-tip {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin: 8rpx 0 20rpx;
}

.qr-box {
  width: 320rpx;
  height: 320rpx;
  margin: 0 auto;
  background: #fafafa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-img {
  width: 100%;
  height: 100%;
}

.qr-placeholder {
  font-size: 24rpx;
  color: #999;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 20rpx;
  z-index: 10;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  &.ghost {
    background: #fff;
    color: #667eea;
    border: 2rpx solid #667eea;
  }
  &.waiting { background: #faad14; color: #fff; }
  &.normal { background: #fff; color: #666; border: 1rpx solid #ddd; }
}

.loading-state {
  padding: 120rpx 30rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.share-entry {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 16rpx;
  padding: 26rpx 30rpx;
  margin-bottom: 20rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
}
</style>