<template>
  <view class="page-container">
    <view v-if="activity" class="detail-wrap">
      <view class="card">
        <view class="card-head">
          <view class="head-main">
            <view v-if="seriesInfo" class="series-chip" @click="goSeries">
              <text class="series-chip-text">系列 · {{ seriesInfo.title }}</text>
              <text class="series-chip-arrow">›</text>
            </view>
            <text class="title">{{ activity.title }}</text>
          </view>
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
        <view v-if="fee.cost > 0" class="info-row">
          <text class="info-label">费用</text>
          <text class="info-value">
            现价 {{ fee.cost }} 积分
            <template v-if="fee.mode === 'tier' && fee.name">（档位 {{ fee.name }}）</template>
            <template v-else-if="fee.mode === 'factor'">（基础 {{ fee.base }}）</template>
          </text>
        </view>

        <view v-if="activity.description" class="desc">
          <text class="desc-title">活动介绍</text>
          <text class="desc-content">{{ activity.description }}</text>
        </view>
      </view>

      <!-- 回放与资料（活动结束后的沉淀内容） -->
      <view v-if="hasAssets" class="card assets-card">
        <text class="assets-title">回放与资料</text>
        <view v-if="assets.recordingUrl" class="assets-item" @click="openRecording">
          <text class="assets-icon">▶</text>
          <text class="assets-name">活动回放</text>
          <text class="assets-arrow">›</text>
        </view>
        <view
          v-for="m in assets.materials"
          :key="m.name + m.url"
          class="assets-item"
          @click="openMaterial(m)"
        >
          <text class="assets-icon">📄</text>
          <text class="assets-name">{{ m.name }}</text>
          <text class="assets-arrow">›</text>
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
          <text>{{ isFull ? '立即候补' : (fee.cost > 0 ? `报名 · ${fee.cost} 积分` : '立即报名') }}</text>
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
        <view v-if="activity.status === 'ended' && !canSelf" class="action-btn primary" @click="openReview">
          <text>{{ reviewed ? '已评价' : '去评价' }}</text>
        </view>
        <view v-if="activity.status === 'ended' && canSelf" class="action-btn ghost" @click="openReview">
          <text>{{ reviewed ? '已评价' : '去评价' }}</text>
        </view>
      </view>
    </view>

    <view v-if="!activity && loading" class="loading-state"><text>加载中...</text></view>
    <view v-if="!activity && !loading" class="loading-state"><text>活动不存在或已下架</text></view>

    <!-- 报名信息弹层 -->
    <view class="signup-mask" v-if="showSignupForm" @click="showSignupForm = false">
      <view class="signup-panel" @click.stop>
        <text class="signup-title">填写报名信息</text>
        <view v-for="f in formFields" :key="f.key" class="signup-field">
          <text class="signup-label">{{ f.label }}<text v-if="f.required" class="req">*</text></text>

          <input v-if="f.type === 'text' || f.type === 'phone'" class="signup-input"
            v-model="signupData[f.key]" :type="f.type === 'phone' ? 'number' : 'text'"
            :placeholder="f.placeholder || ''" />

          <textarea v-else-if="f.type === 'textarea'" class="signup-textarea" v-model="signupData[f.key]" />

          <view v-else-if="f.type === 'radio'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: signupData[f.key] === o }" @click="signupData[f.key] = o">{{ o }}</text>
          </view>

          <picker v-else-if="f.type === 'select'" mode="selector" :range="(f.options || [])"
            @change="e => signupData[f.key] = (f.options || [])[Number(e.detail.value)]">
            <view class="signup-picker">
              <text>{{ signupData[f.key] || '请选择' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>

          <view v-else-if="f.type === 'multi'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: (signupData[f.key] || []).includes(o) }"
              @click="toggleMulti(f, o)">{{ o }}</text>
          </view>

          <input v-else-if="f.type === 'number'" class="signup-input" type="number" v-model="signupData[f.key]" />
        </view>
        <view class="signup-actions">
          <view class="signup-btn cancel" @click="showSignupForm = false"><text>取消</text></view>
          <view class="signup-btn submit" @click="submitSignupForm"><text>确认报名</text></view>
        </view>
      </view>
    </view>

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

    <!-- 评价弹层 -->
    <view class="review-mask" v-if="showReview" @click="showReview = false">
      <view class="review-panel" @click.stop>
        <text class="review-title">评价本次活动</text>

        <text class="review-field-label">评分</text>
        <view class="star-row">
          <text
            v-for="n in 5"
            :key="n"
            class="star"
            :class="{ active: n <= reviewRating }"
            @click="reviewRating = n"
          >★</text>
          <text class="star-value">{{ reviewRating ? reviewRating + ' 分' : '请选择' }}</text>
        </view>

        <text class="review-field-label">NPS 推荐度（0-10）</text>
        <view class="nps-row">
          <text
            v-for="n in 11"
            :key="n"
            class="nps-num"
            :class="{ active: reviewNps === n - 1 }"
            @click="reviewNps = n - 1"
          >{{ n - 1 }}</text>
        </view>

        <text class="review-field-label">评价内容</text>
        <textarea
          class="review-textarea"
          v-model="reviewText"
          placeholder="说说本次活动的体验..."
          placeholder-class="textarea-placeholder"
          :maxlength="500"
        />

        <view class="review-actions">
          <view class="review-btn cancel" @click="showReview = false"><text>取消</text></view>
          <view class="review-btn submit" @click="submitReview"><text>确认</text></view>
        </view>
      </view>
    </view>
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
  submitActivityReview,
  getUserInfo,
  getActivityFee,
} from '../../services/api'
import { getToken, getUser } from '../../utils/storage'
import UQRCode from 'uqrcodejs'
import SharePoster from '../../components/share-poster/share-poster.vue'

let id = ''
const activity = ref<any>(null)
const loading = ref(false)
const fee = ref<{ mode: string; cost: number; feeCollectAt: string; name: string; base: number }>({
  mode: 'flat',
  cost: 0,
  feeCollectAt: 'signup',
  name: '',
  base: 0,
})
const signedUp = ref(false)
const waitlisted = ref(false)
const waitlistPosition = ref(0)
const isFull = computed(() => (activity.value?.usedCapacity ?? 0) >= (activity.value?.capacity ?? 0))
const qrcodeUrl = ref('')
const showSharePoster = ref(false)
const showReview = ref(false)
const reviewRating = ref(0)
const reviewNps = ref<number | null>(null)
const reviewText = ref('')
const reviewed = ref(false)
const showSignupForm = ref(false)
const signupData = ref<Record<string, any>>({})

const formFields = computed(() => {
  const cfg = activity.value?.formConfig
  return Array.isArray(cfg) ? cfg : []
})

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

/** 所属活动系列（后端 populate 填充 belongsToSeries） */
const seriesInfo = computed(() => {
  const s = activity.value?.belongsToSeries
  return s?.documentId && s?.title ? s : null
})

/** 回放/资料 assets（后端 detail 返回的 { recordingUrl, materials }） */
const assets = computed(() => {
  const a = activity.value?.assets
  if (!a || typeof a !== 'object') return { recordingUrl: '', materials: [] }
  return {
    recordingUrl: a.recordingUrl || '',
    materials: Array.isArray(a.materials) ? a.materials : [],
  }
})
const hasAssets = computed(() => Boolean(assets.value.recordingUrl || assets.value.materials.length))

function openUrl(url: string) {
  if (!url) return
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在网页端打开', icon: 'none' })
  // #endif
}

function openRecording() {
  if (!assets.value.recordingUrl) return
  openUrl(assets.value.recordingUrl)
}
function openMaterial(m: { name: string; url: string }) {
  if (m?.url) openUrl(m.url)
}

function goSeries() {
  const s = seriesInfo.value
  if (!s) return
  uni.navigateTo({ url: `/pages/activity/series?id=${s.documentId}` })
}

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
  loadFee()
  restoreSignupState()
}

/** 加载活动费用预览（失败静默保留默认值） */
async function loadFee() {
  if (!id) return
  try {
    const res = await getActivityFee(id)
    if (res) {
      fee.value = {
        mode: res.mode ?? 'flat',
        cost: Number(res.cost) || 0,
        feeCollectAt: res.feeCollectAt ?? 'signup',
        name: res.name ?? '',
        base: Number(res.base) || 0,
      }
    }
  } catch (e) {
    console.warn('加载活动费用失败，使用默认值', e)
  }
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

function openSignupForm() {
  signupData.value = {}
  showSignupForm.value = true
}

function toggleMulti(f: any, o: string) {
  const arr = Array.isArray(signupData.value[f.key]) ? [...signupData.value[f.key]] : []
  const i = arr.indexOf(o)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(o)
  signupData.value[f.key] = arr
}

function validateSignupForm(): string {
  for (const f of formFields.value) {
    const v = signupData.value[f.key]
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (f.required && empty) return `请填写${f.label}`
    if (empty) continue
    if (f.type === 'phone' && !/^1[3-9]\d{9}$/.test(String(v))) return `请填写正确的${f.label}`
    if (f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n)) return `请填写正确的${f.label}`
      if (f.min != null && n < Number(f.min)) return `${f.label}不能小于${f.min}`
      if (f.max != null && n > Number(f.max)) return `${f.label}不能大于${f.max}`
    }
    if ((f.type === 'radio' || f.type === 'select') && !(f.options || []).includes(v)) return `请选择正确的${f.label}`
    if (f.type === 'multi') {
      const bad = (v || []).some((x: string) => !(f.options || []).includes(x))
      if (bad) return `请选择正确的${f.label}`
    }
  }
  return ''
}

function submitSignupForm() {
  const err = validateSignupForm()
  if (err) { uni.showToast({ title: err, icon: 'none' }); return }
  const formData = { ...signupData.value }
  showSignupForm.value = false
  doSignup(formData)
}

function onSignup() {
  if (formFields.value.length) {
    openSignupForm()
  } else {
    doSignup()
  }
}

async function doSignup(formData?: Record<string, any>) {
  uni.showLoading({ title: '报名中...' })
  try {
    const result = await signupActivity(id, formData)
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
      } else if ((result as any)?.reason === 'insufficient_points') {
        uni.showToast({ title: '积分不足，无法报名', icon: 'none' })
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
    } else if (result?.reason === 'insufficient_points') {
      uni.showToast({ title: '积分不足，无法签到', icon: 'none' })
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
    if (found?.reviewedAt) reviewed.value = true
    if (signedUp.value) nextTick(() => generateQrcode())
  } catch (e) {
    // 无需登录则跳过，登录跳转交给 request 内部逻辑
  }
}

/** 打开评价弹层（已提交则提示） */
function openReview() {
  if (reviewed.value) {
    uni.showToast({ title: '已评价过', icon: 'none' })
    return
  }
  showReview.value = true
}

/** 提交评价 */
async function submitReview() {
  if (!reviewRating.value || reviewRating.value < 1) {
    uni.showToast({ title: '请先选择评分（1-5星）', icon: 'none' })
    return
  }
  try {
    const result = await submitActivityReview(id, {
      rating: reviewRating.value,
      nps: reviewNps.value ?? undefined,
      review: reviewText.value || undefined,
    })
    if ((result as any)?.ok) {
      reviewed.value = true
      showReview.value = false
      uni.showToast({ title: '评价成功', icon: 'success' })
    } else {
      uni.showToast({ title: '评价失败', icon: 'none' })
    }
  } catch (e: any) {
    const msg = e?.error?.message || e?.message || ''
    if (msg.includes('尚未报名')) {
      uni.showToast({ title: '尚未报名，无法评价', icon: 'none' })
    } else {
      uni.showToast({ title: '评价失败', icon: 'none' })
    }
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

.head-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.series-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #f6f4ff;
  border-radius: 20rpx;
  padding: 6rpx 18rpx;
  margin-bottom: 12rpx;
}

.series-chip-text {
  font-size: 22rpx;
  color: #667eea;
  max-width: 420rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-chip-arrow {
  font-size: 24rpx;
  color: #764ba2;
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

.review-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.review-panel {
  width: 640rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 40rpx 30rpx;
  box-sizing: border-box;
}
.review-title {
  display: block;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 30rpx;
}
.review-field-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 16rpx;
}
.star-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 30rpx;
}
.star {
  font-size: 52rpx;
  color: #ddd;
}
.star.active {
  color: #fa8c16;
}
.star-value {
  font-size: 24rpx;
  color: #999;
  margin-left: 8rpx;
}
.nps-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 30rpx;
}
.nps-num {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  border-radius: 8rpx;
  background: #f5f5f5;
  color: #666;
  font-size: 24rpx;
}
.nps-num.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
.review-textarea {
  width: 100%;
  height: 160rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
  font-size: 26rpx;
  margin-bottom: 30rpx;
}
.textarea-placeholder {
  color: #bbb;
}
.review-actions {
  display: flex;
  gap: 20rpx;
}
.review-btn {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.review-btn.cancel {
  background: #f5f5f5;
  color: #666;
}
.review-btn.submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.signup-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 99; display: flex; align-items: flex-end; justify-content: center; }
.signup-panel { width: 100%; max-height: 78vh; overflow-y: auto; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); }
.signup-title { font-size: 32rpx; font-weight: 600; color: #333; margin-bottom: 24rpx; }
.signup-field { margin-bottom: 28rpx; }
.signup-label { display: block; font-size: 26rpx; color: #333; margin-bottom: 12rpx; }
.req { color: #ff4d4f; margin-left: 4rpx; }
.signup-input { border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.signup-textarea { width: 100%; box-sizing: border-box; min-height: 140rpx; border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.signup-picker { border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; color: #333; display: flex; justify-content: space-between; }
.picker-arrow { font-size: 22rpx; color: #999; }
.signup-options { display: flex; flex-wrap: wrap; gap: 16rpx; }
.signup-opt { font-size: 26rpx; color: #666; padding: 10rpx 28rpx; border: 1rpx solid #ddd; border-radius: 28rpx; }
.signup-opt.on { color: #667eea; border-color: #667eea; background: rgba(102,126,234,.08); }
.signup-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }
.signup-btn { flex: 1; text-align: center; padding: 22rpx 0; border-radius: 40rpx; font-size: 30rpx; }
.signup-btn.cancel { background: #f5f5f5; color: #666; }
.signup-btn.submit { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }

.assets-card { padding: 30rpx; }
.assets-title { display: block; font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 20rpx; }
.assets-item {
  display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  &:last-child { border-bottom: none; }
}
.assets-icon { font-size: 30rpx; color: #667eea; }
.assets-name { flex: 1; font-size: 28rpx; color: #333; }
.assets-arrow { font-size: 28rpx; color: #ccc; }
</style>