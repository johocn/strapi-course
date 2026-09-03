# 在地·剧本游 · C 端沉浸剧本层 —— 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 C 端（`e:\code\shao` uni-app H5）实现剧本游沉浸层——新增剧本游专用页（选角→走线打卡→主线谜底→终章兑奖），并在活动详情页为旅游模式活动提供「进入剧本」入口；全部调用已上线的后端接口。

**Architecture:** 纯前端新增。`pages/activity/tour.vue` 单页承载沉浸层，依赖 `services/api.ts` 新增的 5 个剧本游函数（镜像 `request`/`BASE_API` 约定）；`pages.json` 注册该页；`detail.vue` 在 `.share-row` 区按 `activity?.tourMode` 渲染「进入剧本」入口。复用现有登录态、路由、toast 约定。

**Tech Stack:** uni-app（Vue3 `<script setup>`）、vite 构建 H5。

**部署纪律（铁律）:** `e:\code\shao` 不许升 vue / 加新依赖，仅构建期产物改动；构建用 `npm run build:h5`，分发到 `v.joho.cn`（joho 主机）用 `powershell -ExecutionPolicy Bypass -File .\deploy-h5.ps1`；自检用 `rg` 在 `dist/build/h5/assets/` grep 新标识（如 `tourCheckinStation`、`tour.vue` 产物），无命中=未重建，禁止部署。发布后需硬刷验证。

---
### Task 1: services/api.ts 新增 5 个剧本游函数

**Files:**
- Modify: `e:\code\shao\services\api.ts`（追加在 `submitActivityReview`（约 L1349）附近或文件末尾注释区后均可）

- [ ] **Step 1: 追加剧本游 API 函数**

```ts
// ==================== 剧本游（本地文化旅游·沉浸剧本层） ====================
/** 剧本主视角：剧目信息 + 当前用户进度；未报名/非剧本游由后端抛业务码 */
export async function getTourStory(documentId: string) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/tour/story`, { method: 'GET' })
  return res
}
/** 选择角色：幂等，可改选 */
export async function tourChooseRole(documentId: string, role: string) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/tour/choose-role`, {
    method: 'POST',
    data: { role },
  })
  return res
}
/** 到站打卡：幂等，发站点积分 */
export async function tourCheckinStation(documentId: string, stationOrder: number) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/tour/checkin-station`, {
    method: 'POST',
    data: { stationOrder },
  })
  return res
}
/** 主线谜底答题：答对发主线积分（返回 { correct, already, progress }） */
export async function tourAnswerMain(documentId: string, answer: string) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/tour/answer-main`, {
    method: 'POST',
    data: { answer },
  })
  return res
}
/** 终章兑奖：站点集齐 + 谜底破解后发放终章积分（返回 { already, progress }） */
export async function tourClaimFinale(documentId: string) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/tour/claim-finale`, { method: 'POST' })
  return res
}
```

- [ ] **Step 2: 静态自检** `rg -n "getTourStory|tourClaimFinale" e:\code\shao\services\api.ts`，期望两次各命中 ≥1。

### Task 2: pages.json 注册剧本游页面

**Files:**
- Modify: `e:\code\shao\pages.json`

- [ ] **Step 1: 在 `pages/activity/promo` 条目后（L185 后）追加 tour 页**

```json
		{
			"path": "pages/activity/tour",
			"style": {
				"navigationBarTitleText": "剧本游"
			}
		},
```

注意对齐与上层同缩进（上层数组元素用 tab 缩进 + `"path"` 前一个 tab），保持 JSON 合法（上一元素 promo 的 `}` 后补逗号）。

### Task 3: 新建页 pages/activity/tour.vue（沉浸剧本层）

**Files:**
- Create: `e:\code\shao\pages\activity\tour.vue`

- [ ] **Step 1: 写入完整页面**（`<script setup>`，Vue3）

```vue
<template>
  <view class="tour-page">
    <!-- 加载中 -->
    <view v-if="loading" class="tour-state"><text>加载序章中...</text></view>
    <!-- 加载失败重试 -->
    <view v-else-if="!story" class="tour-state tour-state--retry" @click="loadStory">
      <text>加载失败，点击重试</text>
    </view>

    <template v-else-if="story">
      <!-- 序章：背景 + 选角 -->
      <view class="prologue">
        <text class="prologue-title">{{ story.title }}</text>
        <text class="prologue-backdrop">{{ story.backdrop }}</text>

        <view class="role-block" v-if="!progress?.role">
          <text class="role-tip">选择一个角色，开始你的故事</text>
          <view class="role-list">
            <view v-for="r in storyRoles" :key="r.id" class="role-item"
              :class="{ on: selectedRole === r.id }" @click="selectedRole = r.id">
              <text class="role-name">{{ r.name }}</text>
              <text v-if="r.desc" class="role-desc">{{ r.desc }}</text>
            </view>
          </view>
          <view class="role-action" @click="submitRole" :class="{ disabled: !selectedRole }">
            <text>{{ submittingRole ? '选择中...' : '选择角色进入' }}</text>
          </view>
        </view>
        <text class="role-chosen" v-else>当前角色：<text class="role-chosen-name">{{ currentRoleName }}</text></text>
      </view>

      <!-- 站点打卡 -->
      <view class="section">
        <view class="section-head"><text class="section-title">线路站点</text></view>
        <view class="station-list">
          <view v-for="s in stations" :key="s.order" class="station-item"
            :class="{ done: progressStations.includes(s.order) }">
            <text class="station-order">{{ s.order }}</text>
            <view class="station-body">
              <text class="station-name">{{ s.name }}</text>
              <text class="station-clue">{{ s.clue || '到点扫码打卡' }}</text>
            </view>
            <view class="station-state">
              <text v-if="progressStations.includes(s.order)" class="done-tag">已完成</text>
              <view v-else class="station-btn" @click="checkin(s.order)"><text>打卡</text></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 主线谜底 -->
      <view class="section" v-if="story.mainPuzzle">
        <view class="section-head"><text class="section-title">主线谜底</text></view>
        <text class="puzzle-text">{{ story.mainPuzzle }}</text>
        <input class="puzzle-input" v-model="mainAnswer" :placeholder="story.hint || '输入你的答案'" />
        <view class="role-action" @click="submitAnswer">
          <text>{{ progress?.mainSolved ? '已破解' : (answering ? '验证中...' : '提交答案') }}</text>
        </view>
        <text class="feedback" :class="answerFeedback ? 'good' : ''">{{ answerFeedback }}</text>
      </view>

      <!-- 终章兑奖 -->
      <view class="section finale">
        <view class="section-head"><text class="section-title">终章兑奖</text></view>
        <text class="finale-hint">
          集齐全部站点并破解主线谜底后，可领取 {{ story.finalePoints }} 积分
        </text>
        <view class="role-action" @click="claimFinale" :class="{ disabled: !finaleReady || progress?.finaleClaimed }">
          <text>{{ claiming ? '发放中...' : (progress?.finaleClaimed ? '已领取终章大奖' : '领取终章积分') }}</text>
        </view>
        <text class="feedback good" v-if="progress?.finaleClaimed">终章积分已到账，恭喜完成任务！</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getTourStory,
  tourChooseRole,
  tourCheckinStation,
  tourAnswerMain,
  tourClaimFinale,
} from '../../services/api'

const documentId = ref('')
const story = ref<any>(null)
const loading = ref(false)
const progress = ref<any>(null)

const selectedRole = ref('')
const submittingRole = ref(false)
const mainAnswer = ref('')
const answering = ref(false)
const answerFeedback = ref('')
const claiming = ref(false)

const storyRoles = computed(() => (Array.isArray(story.value?.roles) ? story.value.roles : []))
const stations = computed(() =>
  (Array.isArray(story.value?.itinerary) ? story.value.itinerary : []).slice().sort((a: any, b: any) => a.order - b.order)
)
const progressStations = computed(() => {
  const arr = progress.value?.stations
  return Array.isArray(arr) ? arr : []
})
const currentRoleName = computed(() => {
  const r = storyRoles.value.find((x: any) => String(x.id) === String(progress.value?.role)) || storyRoles.value.find((x: any) => String(x.name) === progress.value?.role)
  return r?.name || progress.value?.role || ''
})
const finaleReady = computed(
  () => stations.value.length > 0 && progressStations.value.length >= stations.value.length && !!progress.value?.mainSolved
)

onLoad((opts: any) => {
  documentId.value = opts?.id || ''
  if (documentId.value) loadStory()
})

async function loadStory() {
  if (!documentId.value) return
  loading.value = true
  try {
    const res = await getTourStory(documentId.value)
    story.value = res ?? null
    progress.value = res?.progress ?? null
    uni.setNavigationBarTitle({ title: res?.title || '剧本游' })
  } catch (e: any) {
    story.value = null
    if (e?.code === 'NOT_SIGNED') {
      uni.showToast({ title: '请先报名', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
    } else if (e?.code === 'NOT_TOUR') {
      uni.showToast({ title: '该活动不是剧本游', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
    }
  } finally {
    loading.value = false
  }
}

async function submitRole() {
  if (!selectedRole.value || submittingRole.value) return
  submittingRole.value = true
  try {
    const res = await tourChooseRole(documentId.value, selectedRole.value)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: '角色已选择', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '选择失败', icon: 'none' })
  } finally {
    submittingRole.value = false
  }
}

async function checkin(order: number) {
  try {
    const res = await tourCheckinStation(documentId.value, order)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: res?.already ? '该站点已打卡' : `打卡成功 +${story.value?.stationPoints}积分`, icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '打卡失败', icon: 'none' })
  }
}

async function submitAnswer() {
  if (progress.value?.mainSolved || answering.value) return
  if (!mainAnswer.value.trim()) return uni.showToast({ title: '请输入答案', icon: 'none' })
  answering.value = true
  try {
    const res = await tourAnswerMain(documentId.value, mainAnswer.value.trim())
    progress.value = res?.progress ?? progress.value
    if (res?.correct) {
      answerFeedback.value = `恭喜破解谜底！+${story.value?.mainPoints}积分`
    } else {
      answerFeedback.value = ''
      uni.showToast({ title: '答案不对，再想想', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    answering.value = false
  }
}

async function claimFinale() {
  if (!finaleReady.value || progress.value?.finaleClaimed || claiming.value) return
  claiming.value = true
  try {
    const res = await tourClaimFinale(documentId.value)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: `已领取 ${story.value?.finalePoints} 积分`, icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '领取失败', icon: 'none' })
  } finally {
    claiming.value = false
  }
}
</script>

<style scoped>
.tour-page { min-height: 100vh; background: #f6f5f1; box-sizing: border-box; padding: 24rpx; }
.tour-state { padding: 160rpx 40rpx; text-align: center; color: #999; font-size: 28rpx; }
.tour-state--retry { color: #6b4f2a; }
.prologue { background: #2f2a24; color: #f3ead8; border-radius: 20rpx; padding: 36rpx 30rpx; margin-bottom: 24rpx; }
.prologue-title { display: block; font-size: 40rpx; font-weight: 700; }
.prologue-backdrop { display: block; margin-top: 16rpx; font-size: 28rpx; line-height: 1.7; color: #d9cdb4; }
.role-block { margin-top: 28rpx; }
.role-tip { font-size: 26rpx; color: #c9ba9a; }
.role-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.role-item { flex: 1 1 42%; min-width: 0; background: #3c362d; border: 2rpx solid transparent; border-radius: 14rpx; padding: 18rpx; }
.role-item.on { border-color: #d9a44c; }
.role-name { display: block; font-size: 30rpx; font-weight: 600; }
.role-desc { display: block; margin-top: 6rpx; font-size: 24rpx; color: #b7a98a; }
.role-action { margin-top: 24rpx; text-align: center; background: #d9a44c; color: #2f2a24; border-radius: 999rpx; padding: 22rpx 0; font-size: 30rpx; font-weight: 600; }
.role-action.disabled { opacity: 0.5; }
.role-chosen { display: block; margin-top: 20rpx; font-size: 28rpx; color: #b7a98a; }
.role-chosen-name { color: #d9a44c; font-weight: 600; }
.section { background: #fff; border-radius: 20rpx; padding: 28rpx 26rpx; margin-bottom: 24rpx; }
.section-head { margin-bottom: 16rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: #2f2a24; }
.station-item { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-bottom: 1rpx solid #f0ece3; }
.station-item:last-child { border-bottom: none; }
.station-item.done { opacity: 0.55; }
.station-order { width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: #efe7d6; color: #6b4f2a; font-weight: 600; }
.station-item.done .station-order { background: #2f2a24; color: #d9a44c; }
.station-body { flex: 1; min-width: 0; }
.station-name { display: block; font-size: 30rpx; font-weight: 600; color: #2f2a24; }
.station-clue { display: block; margin-top: 4rpx; font-size: 24rpx; color: #999; }
.station-btn { background: #d9a44c; color: #2f2a24; border-radius: 999rpx; padding: 10rpx 26rpx; font-size: 26rpx; font-weight: 600; }
.done-tag { color: #2f2a24; font-size: 26rpx; }
.puzzle-text { display: block; font-size: 28rpx; line-height: 1.7; color: #333; }
.puzzle-input { margin-top: 18rpx; border: 1rpx solid #e2dbcb; border-radius: 12rpx; padding: 18rpx; font-size: 28rpx; }
.feedback { display: block; margin-top: 16rpx; font-size: 26rpx; color: #c0392b; }
.feedback.good { color: #27ae60; }
.finale-hint { display: block; font-size: 26rpx; color: #999; margin-bottom: 20rpx; }
</style>
```

### Task 4: 活动详情页加「进入剧本」入口

**Files:**
- Modify: `e:\code\shao\pages\activity\detail.vue`

- [ ] **Step 1: 在 `.share-row` 内（「分享得积分」条目之后）追加入口**

在 detail.vue 第 L177-180（`<view class="share-entry" @click="showShareGuide = true">...</view>`）之后追加（`activity` 在 detail.vue 中已为可响应对象，含 `documentId`；`id` 为页面路由参数）：

```html
<view v-if="activity?.tourMode" class="share-entry" @click="goTour">
  <text class="share-entry-title">进入剧本</text>
  <text class="share-entry-sub">沉浸式文化体验</text>
</view>
```

- [ ] **Step 2: 在脚本区新增 `goTour` 方法**（与 `onShareGuideClaimed` 同级，`<script>` 函数体）

```ts
function goTour() {
  const docId = activity?.documentId || id
  if (!docId) return uni.showToast({ title: '活动编号缺失', icon: 'none' })
  uni.navigateTo({ url: `/pages/activity/tour?id=${docId}` })
}
```

### Task 5: 构建 H5 + 自检 + 部署 v.joho.cn

**Files:**
- Build: `e:\code\shao`（`npm run build:h5`）

- [ ] **Step 1: 本地构建 H5**

```bash
cd e:\code\shao && npm run build:h5
```
期望：`dist/build/h5/index.html` 与 `dist/build/h5/assets/` 生成。

- [ ] **Step 2: 自检产物含新标识（必须命中）**

```bash
cd e:\code\shao && rg -l "tourCheckinStation" dist/build/h5/assets/
rg -l "getTourStory|tourClaimFinale" dist/build/h5/assets/
```
期望：命中对应的 js 产物。「进入剧本」入口应与 tour 页共享同一异步 chunk 或主包（以命中为准）。

- [ ] **Step 3: 部署到 v.joho.cn（joho 主机）**

```bash
cd e:\code\shao && powershell -ExecutionPolicy Bypass -File .\deploy-h5.ps1
```
期望：远端返回 `SYNC_OK`。

- [ ] **Step 4: 线上验证** 微信/浏览器硬刷后：
- 打开某 `tourMode=true` 的活动详情页 → 底部/分享区出现「进入剧本」；
- 点入 tour 页：未报名回到详情、已报名见选角→打卡→答题→终章；
- 打卡重复点提示「该站点已打卡」，终章在站点与谜底齐备后才可领。