<template>
  <view class="page-container">
    <!-- 顶部背景区域 -->
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <!-- 首登欢迎提示（由 auth-callback 写入 isNewUser=1 触发，点击或 5 秒后自动消失） -->
        <view v-if="showWelcome" class="welcome-banner" @click="dismissWelcome">
          <text class="welcome-icon">🎉</text>
          <text class="welcome-text">欢迎加入{{ siteConfig?.siteName ?? '圣麟教育' }}，开启学习之旅！</text>
          <text class="welcome-close">×</text>
        </view>
        <view class="header-top">
          <view class="header-left">
            <text class="header-title">{{ siteConfig?.siteName || '全部课程' }}</text>
            <text class="header-subtitle">学习课程，答题赢积分</text>
          </view>
          <view class="header-right">
            <view v-if="isLoggedIn" class="user-info" @click="goToProfile">
              <view class="user-avatar">
                <text>{{ getDisplayName().slice(0, 1) || '用' }}</text>
              </view>
              <text class="user-name">{{ getDisplayName() || '用户' }}</text>
            </view>
            <view v-else class="login-btn" @click="goToLogin">
              <text>登录</text>
            </view>
          </view>
        </view>
        
        <!-- 积分展示 -->
        <view v-if="isLoggedIn" class="points-banner">
          <view class="points-left">
            <text class="points-icon">💰</text>
            <text class="points-label">我的积分</text>
          </view>
          <view class="points-right">
            <text class="points-value">{{ pointBalance }}</text>
            <text class="points-unit">积分</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 跑马灯公告栏 -->
    <notice-bar position="home-notice" />

    <!-- 广告幻灯片 -->
    <ad-banner position="home-banner" />

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input 
        class="search-input" 
        placeholder="搜索课程名称" 
        v-model="searchKeyword"
        @confirm="handleSearch"
      />
      <view class="search-btn" @click="handleSearch">
        <text>搜索</text>
      </view>
    </view>

    <!-- 猜你喜欢（登录后基于画像兴趣标签推荐） -->
    <view v-if="isLoggedIn && recommendCourses.length" class="recommend-section">
      <view class="recommend-header">
        <text class="recommend-title">猜你喜欢</text>
        <scroll-view v-if="recommendInterests.length" scroll-x class="interest-scroll" :show-scrollbar="false">
          <view class="interest-row">
            <text v-for="tag in recommendInterests" :key="tag" class="interest-chip"># {{ tag }}</text>
          </view>
        </scroll-view>
      </view>

      <!-- 推荐课程横滑 -->
      <scroll-view scroll-x class="recommend-scroll" :show-scrollbar="false">
        <view class="recommend-row">
          <view
            v-for="c in recommendCourses"
            :key="c.documentId"
            class="recommend-item"
            @click="goToCourseDetail(c.documentId)"
          >
            <image v-if="c.cover?.url" :src="getImageUrl(c.cover.url)" mode="aspectFill" class="rec-cover" lazy-load />
            <view v-else class="rec-cover rec-cover--ph">📚</view>
            <view class="rec-badge">
              <text v-if="c.courseType === 'free' || (!c.courseType && !c.isPaid)" class="rec-badge-free">免费</text>
              <text v-else-if="c.courseType === 'points'" class="rec-badge-points">{{ c.pointsPrice || 0 }}积分</text>
              <text v-else class="rec-badge-paid">付费</text>
            </view>
            <text class="rec-title">{{ c.title }}</text>
            <text class="rec-meta">{{ c.category || '综合' }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 推荐活动 -->
      <view v-if="recommendActivities.length" class="rec-activity">
        <view class="rec-activity-head">
          <text class="rec-activity-title">近期活动</text>
          <text class="rec-activity-entry" @click="goActivityCalendar">📅 活动日历 »</text>
          <text class="rec-activity-entry" @click="goActivityList">更多活动 »</text>
        </view>
        <view
          v-for="a in recommendActivities"
          :key="a.documentId"
          class="rec-activity-item"
          @click="goToActivity(a.documentId)"
        >
          <text class="rec-activity-name">{{ a.title }}</text>
          <text class="rec-activity-meta">{{ a.type === '其他' ? '活动' : a.type }}</text>
        </view>
      </view>
    </view>

    <!-- 分类标签 -->
    <view class="category-tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view 
          v-for="cat in categories" 
          :key="cat.id"
          :class="['tab-item', { active: activeCategory === cat.id }]"
          @click="handleCategoryChange(cat.id)"
        >
          <text>{{ cat.name }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 快捷过滤芯片条 -->
    <course-filter-chips
      v-model="priceType"
      :filter-state="filterState"
      @open-drawer="drawerVisible = true"
    />

    <!-- 排序 + 视图切换条 -->
    <course-sort-bar
      v-model="sortKey"
      :view-mode="viewMode"
      :show-rating="false"
      @update:view-mode="handleViewModeChange"
    />

    <!-- 已选条件 + 结果计数 + 空状态 -->
    <course-active-filters
      :filters="filterState"
      :price-type="priceType"
      :category="activeCategory"
      :category-list="categories"
      :tags="tagList"
      :total="totalCourses"
      :has-result="courseList.length > 0"
      @remove="handleRemoveFilter"
      @clear-all="handleClearAll"
    />

    <!-- 课程列表（Grid/List 双模式） -->
    <view v-if="courseList.length > 0" :class="['course-list', viewMode === 'grid' ? 'course-list--grid' : 'course-list--list']">
      <course-card
        v-for="course in courseList"
        :key="course.documentId"
        :course="course"
        :mode="viewMode"
        @click="goToCourseDetail"
      />
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>

    <!-- 筛选弹层 -->
    <course-filter-drawer
      v-model:visible="drawerVisible"
      v-model="filterState"
      :price-type="priceType"
      :tags="tagList"
      @update:price-type="handleDrawerPriceType"
      @apply="handleApplyFilter"
      @reset="handleResetFilter"
    />

    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockDialogMode"
      :reason="lockDialogReason"
      @goto="handleLockGoto"
      @skip="handleLockSkip"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCourseList, getPointBalance, getCourseCategories, getInviteStats, getTags, getMyCourseProgresses, getRecommend } from '../../services/api'
import { validateLogin, getAuthUser, checkLogin } from '../../utils/auth'
import { getImageUrl } from '../../utils/env'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import { getShareConfig, getTimelineConfig } from '../../utils/invite'
import { checkItemLock, isCourseCompleted } from '../../utils/sequence-lock'
import type { Course, Tag } from '../../services/api'
import {
  DEFAULT_FILTER_STATE,
  parseUrlQuery,
  buildUrlQuery,
  type SortKey,
  type ViewMode,
  type PriceType,
  type CourseFilterState
} from '../../utils/course-query'
import CourseCard from '../../components/course-card/course-card.vue'
import CourseSortBar from '../../components/course-sort-bar/course-sort-bar.vue'
import CourseFilterChips from '../../components/course-filter-chips/course-filter-chips.vue'
import CourseFilterDrawer from '../../components/course-filter-drawer/course-filter-drawer.vue'
import CourseActiveFilters from '../../components/course-active-filters/course-active-filters.vue'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'

// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
// H5 微信环境:用 setupPageShare 配置分享(小程序的 onShareAppMessage 在 H5 不生效)
if (typeof window !== 'undefined' && isWechatBrowser()) {
  setupPageShare()
}
// #endif

const searchKeyword = ref('')
const activeCategory = ref('all')
const courseList = ref<Course[]>([])
const loading = ref(false)
const user = ref<any>(null)
const pointBalance = ref(0)
const isLoggedIn = ref(false)
const inviteCode = ref('')
const siteConfig = ref<any>(null)
// 首登欢迎提示（auth-callback 写入 isNewUser=1 时触发）
const showWelcome = ref(false)
let welcomeTimer: any = null

// 视图/排序/过滤状态
const viewMode = ref<ViewMode>('grid')
const sortKey = ref<SortKey>('default')
const priceType = ref<PriceType>('all')
const filterState = ref<CourseFilterState>({ ...DEFAULT_FILTER_STATE })
const drawerVisible = ref(false)
const tagList = ref<Tag[]>([])
const totalCourses = ref(0)

// 猜你喜欢（个性化推荐）
const recommendCourses = ref<any[]>([])
const recommendActivities = ref<any[]>([])
const recommendInterests = ref<string[]>([])

// 顺序锁定状态
const courseProgressMap = ref<Record<string, boolean>>({})  // documentId → isCompleted
const lockDialogVisible = ref(false)
const lockDialogMode = ref(false)  // false=软锁, true=硬锁
const lockDialogReason = ref('')
const lockGotoCourseId = ref<string>('')  // 前置未完成课程 ID（去学习按钮跳转目标）
const lockOriginalCourseId = ref<string>('')  // 用户原本想打开的课程 ID（软锁跳过按钮跳转目标）

// 防抖计时器
let debounceTimer: any = null

// ===== 状态持久化 =====

/** 从 URL query 或 localStorage 恢复状态 */
function restoreState() {
  // 1. H5 优先读 URL query
  // #ifdef H5
  const urlQuery = window.location.search.slice(1)
  if (urlQuery) {
    const parsed = parseUrlQuery(urlQuery)
    if (parsed.viewMode) viewMode.value = parsed.viewMode
    if (parsed.sort) sortKey.value = parsed.sort
    if (parsed.category) activeCategory.value = parsed.category
    if (parsed.priceType) priceType.value = parsed.priceType
    if (parsed.filter) {
      filterState.value = {
        ...DEFAULT_FILTER_STATE,
        ...parsed.filter
      }
    }
    if (parsed.q) searchKeyword.value = parsed.q
    return
  }
  // #endif

  // 2. 回退 localStorage
  const savedView = uni.getStorageSync('course_view_mode')
  if (savedView === 'grid' || savedView === 'list') {
    viewMode.value = savedView
  }

  const savedFilter = uni.getStorageSync('course_filter_state')
  if (savedFilter) {
    try {
      const parsed = JSON.parse(savedFilter)
      filterState.value = { ...DEFAULT_FILTER_STATE, ...parsed.filter }
      if (parsed.sort) sortKey.value = parsed.sort
      if (parsed.priceType) priceType.value = parsed.priceType
      if (parsed.category) activeCategory.value = parsed.category
    } catch (e) {
      console.warn('恢复过滤状态失败', e)
    }
  }
}

/** 同步状态到 URL query（H5）+ localStorage */
function persistState() {
  // H5: URL query
  // #ifdef H5
  const query = buildUrlQuery({
    viewMode: viewMode.value,
    sort: sortKey.value,
    category: activeCategory.value,
    priceType: priceType.value,
    filter: filterState.value,
    q: searchKeyword.value
  })
  history.replaceState(null, '', `?${query}`)
  // #endif

  // localStorage
  uni.setStorageSync('course_view_mode', viewMode.value)
  uni.setStorageSync('course_filter_state', JSON.stringify({
    sort: sortKey.value,
    priceType: priceType.value,
    category: activeCategory.value,
    filter: filterState.value
  }))
}

// ===== 防抖加载课程 =====
function debouncedLoadCourses() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    loadCourses()
  }, 300)
}

// ===== 排序 / 快捷价格过滤（chip 与排序条仅 emit 更新 ref，需监听以触发重载） =====
watch(sortKey, () => {
  persistState()
  debouncedLoadCourses()
})

watch(priceType, () => {
  persistState()
  debouncedLoadCourses()
})

// ===== 事件处理 =====
function handleViewModeChange(mode: ViewMode) {
  viewMode.value = mode
  uni.setStorageSync('course_view_mode', mode)
  persistState()
}

function handleApplyFilter(state: CourseFilterState) {
  filterState.value = state
  persistState()
  debouncedLoadCourses()
}

/** 筛选弹层内选择精品/推荐时同步 priceType */
function handleDrawerPriceType(value: PriceType) {
  priceType.value = value
  persistState()
  debouncedLoadCourses()
}

function handleResetFilter() {
  filterState.value = { ...DEFAULT_FILTER_STATE }
  persistState()
  debouncedLoadCourses()
}

function handleRemoveFilter(payload: { type: string; value: string }) {
  const { type, value } = payload
  if (type === 'priceType') {
    priceType.value = 'all'
  } else if (type === 'category') {
    activeCategory.value = 'all'
  } else if (type === 'priceRange') {
    filterState.value.priceRange = [0, 999]
  } else if (type === 'difficulty' || type === 'language' || type === 'tags') {
    const arr = filterState.value[type as 'difficulty' | 'language' | 'tags']
    const idx = arr.indexOf(value)
    if (idx >= 0) arr.splice(idx, 1)
  }
  persistState()
  debouncedLoadCourses()
}

function handleClearAll() {
  priceType.value = 'all'
  activeCategory.value = 'all'
  filterState.value = { ...DEFAULT_FILTER_STATE }
  searchKeyword.value = ''
  persistState()
  debouncedLoadCourses()
}

function dismissWelcome() {
  showWelcome.value = false
  uni.removeStorageSync('isNewUser')
  if (welcomeTimer) {
    clearTimeout(welcomeTimer)
    welcomeTimer = null
  }
}

function checkNewUserWelcome() {
  if (uni.getStorageSync('isNewUser') === '1') {
    showWelcome.value = true
    // 5 秒后自动消失
    welcomeTimer = setTimeout(() => {
      dismissWelcome()
    }, 5000)
  }
}

function getUserInfo() {
  const loginState = checkLogin()
  isLoggedIn.value = loginState.isLoggedIn
  user.value = loginState.user || getAuthUser()
}

/** 首页展示姓名：与「我的」页保持一致，nickname 优先，兜底 '用户' */
function getDisplayName(): string {
  return user.value?.nickname || user.value?.name || user.value?.username || '用户'
}

// 获取邀请码
async function loadInviteCode() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getInviteStats()
    inviteCode.value = res?.data?.inviteCode || ''
  } catch (e) {
    console.error('获取邀请码失败', e)
  }
}

// 获取积分余额
async function loadPointBalance() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getPointBalance()
    // getPointBalance 已返回 res?.data，所以直接用 res?.balance
    pointBalance.value = res?.balance ?? res?.globalBalance ?? 0
  } catch (e) {
    console.error('获取积分失败', e)
  }
}

// 加载猜你喜欢（个性化推荐，基于画像兴趣标签）
async function loadRecommend() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getRecommend(5)
    const data = res?.data ?? res
    recommendCourses.value = Array.isArray(data?.courses) ? data.courses : []
    recommendActivities.value = Array.isArray(data?.activities) ? data.activities : []
    recommendInterests.value = Array.isArray(data?.interests) ? data.interests.slice(0, 6) : []
  } catch (e) {
    console.error('加载猜你喜欢失败', e)
    recommendCourses.value = []
  }
}

function goToActivity(documentId: string) {
  uni.navigateTo({ url: `/pages/activity/detail?id=${documentId}` })
}

function goActivityCalendar() {
  uni.navigateTo({ url: '/pages/activity/calendar' })
}

function goActivityList() {
  uni.navigateTo({ url: '/pages/activity/list' })
}

function goToProfile() {
  uni.switchTab({ url: '/pages/profile/profile' })
}

// 分类列表
const categories = ref<Array<{ id: string; name: string }>>([
  { id: 'all', name: '全部' }
])

// 加载分类列表
async function loadCategories() {
  try {
    const res: any = await getCourseCategories()
    const categoryList = res?.data || []
    
    // 转换格式并添加"全部"选项
    const formattedCategories = categoryList.map((cat: any) => ({
      id: cat.documentId || cat.id,
      name: cat.name || '未命名分类'
    }))
    
    categories.value = [{ id: 'all', name: '全部' }, ...formattedCategories]
  } catch (e) {
    console.error('加载分类失败', e)
    // 使用默认分类
    categories.value = [
      { id: 'all', name: '全部' },
      { id: 'tech', name: '技术' },
      { id: 'language', name: '语言' },
      { id: 'art', name: '艺术' },
      { id: 'business', name: '商业' }
    ]
  }
}

// 获取难度文本（已移至 CourseCard 组件，此处保留供其他可能引用）

// 加载课程列表
async function loadCourses() {
  loading.value = true
  try {
    // 兼容历史持久化的 priceType='newest'（已从芯片组下掉「✨最新」，仅旧状态兜底）：视为按最新发布排序
    const isLegacyNewest = priceType.value === 'newest'
    const res: any = await getCourseList({
      category: activeCategory.value,
      q: searchKeyword.value,
      sort: isLegacyNewest ? 'newest' : sortKey.value,
      priceType: isLegacyNewest ? 'all' : priceType.value,
      difficulty: filterState.value.difficulty,
      language: filterState.value.language,
      minPrice: filterState.value.priceRange[0],
      maxPrice: filterState.value.priceRange[1],
      tags: filterState.value.tags
    })
    courseList.value = res?.data || []
    totalCourses.value = res?.meta?.pagination?.total || courseList.value.length

    // 加载课程进度（用于顺序锁定判定）
    await loadCourseProgress()
  } catch (e) {
    console.error('加载课程失败', e)
    courseList.value = []
    totalCourses.value = 0
  }
  loading.value = false
}

// 加载课程完成状态（用于顺序锁定判定）
async function loadCourseProgress() {
  if (!validateLogin()) return
  try {
    const res: any = await getMyCourseProgresses()
    const list = res?.data || res || []
    const map: Record<string, boolean> = {}
    for (const item of list) {
      if (item.course?.documentId) {
        map[item.course.documentId] = item.isCompleted === true
      } else if (item.documentId) {
        map[item.documentId] = item.isCompleted === true
      }
    }
    courseProgressMap.value = map
  } catch (e) {
    console.warn('加载课程进度失败（可能未登录）', e)
  }
}

// 加载标签列表
async function loadTags() {
  try {
    const res: any = await getTags()
    tagList.value = (res?.data || []).map((t: any) => ({
      documentId: t.documentId,
      name: t.name,
      color: t.color
    }))
  } catch (e) {
    console.error('加载标签失败', e)
    tagList.value = []
  }
}

// 处理分类切换
function handleCategoryChange(categoryId: string) {
  activeCategory.value = categoryId
  persistState()
  debouncedLoadCourses()
}

// 处理搜索
function handleSearch() {
  persistState()
  debouncedLoadCourses()
}

// 跳转到课程详情
function goToCourseDetail(id: string) {
  const isGuest = uni.getStorageSync('isGuest')
  if (isGuest === 'true') {
    uni.showModal({
      title: '游客模式',
      content: '游客模式下无法学习课程，请登录后继续。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          uni.removeStorageSync('isGuest')
          uni.navigateTo({ url: '/pages/login/login' })
        }
      }
    })
    return
  }

  if (!validateLogin()) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }

  // 顺序锁定检查
  const target = courseList.value.find(c => c.documentId === id)
  if (target && target.sequenceTag && (target.sequenceNumber ?? 0) > 0) {
    // 构造锁定判定所需数据
    const allItems = courseList.value
      .filter(c => c.sequenceTag && (c.sequenceNumber ?? 0) > 0)
      .map(c => ({
        documentId: c.documentId,
        title: c.title,
        sequenceNumber: c.sequenceNumber ?? 0,
        sequenceTag: c.sequenceTag,
        enforceSequence: c.enforceSequence ?? false,
        isCompleted: courseProgressMap.value[c.documentId] ?? false
      }))
    const lockResult = checkItemLock(
      {
        documentId: target.documentId,
        title: target.title,
        sequenceNumber: target.sequenceNumber ?? 0,
        sequenceTag: target.sequenceTag,
        enforceSequence: target.enforceSequence ?? false,
        isCompleted: courseProgressMap.value[target.documentId] ?? false
      },
      allItems
    )
    if (lockResult.locked) {
      lockDialogMode.value = lockResult.enforceMode
      lockDialogReason.value = lockResult.reason
      lockGotoCourseId.value = lockResult.firstIncomplete?.documentId || ''
      lockOriginalCourseId.value = id
      lockDialogVisible.value = true
      return
    }
  }

  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${id}` })
}

// 顺序锁定弹窗：去学习前置课程
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockGotoCourseId.value) {
    uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${lockGotoCourseId.value}` })
  }
}

// 顺序锁定弹窗：软锁跳过，继续学习当前课程
function handleLockSkip() {
  lockDialogVisible.value = false
  if (lockOriginalCourseId.value) {
    uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${lockOriginalCourseId.value}` })
  }
}

// 跳转到登录页
function goToLogin() {
  uni.removeStorageSync('isGuest')
  uni.navigateTo({ url: '/pages/login/login' })
}

// 处理邀请码参数
function handleInviteCode() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  if (options.inviteCode) {
    uni.setStorageSync('inviteCode', options.inviteCode)
    console.log('邀请码已保存:', options.inviteCode)
  }
}

onMounted(() => {
  handleInviteCode()
  restoreState()
  refreshData()
  // 检查首登欢迎提示（auth-callback 写入的 isNewUser 标记）
  checkNewUserWelcome()
})

onShow(() => {
  // 每次页面显示时刷新数据（如登录后返回首页）
  refreshData()
  // H5 微信环境：刷新分享配置（用租户配置兜底 + 登录用户附加邀请码）
  // #ifdef H5
  setupPageShare()
  // #endif
})

function refreshData() {
  getUserInfo()
  loadCategories()
  loadTags()
  debouncedLoadCourses()
  loadPointBalance()
  loadInviteCode()
  loadRecommend()
  siteConfig.value = getStoredAuthConfig()
}

// 微信分享（统一通过 getShareConfig/getTimelineConfig 携带邀请码+邀请人，未登录也用临时码兜底）
onShareAppMessage(() => {
  const cfg = getShareConfig()
  return { title: cfg.title, path: cfg.path, imageUrl: cfg.imageUrl }
})

onShareTimeline(() => {
  const cfg = getTimelineConfig()
  return { title: cfg.title, query: cfg.query, imageUrl: cfg.imageUrl }
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.header {
  position: relative;
  padding: 40rpx 30rpx 2rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 340rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
}

/* 首登欢迎提示 */
.welcome-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(135deg, #fff8e1 0%, #ffe082 100%);
  border-radius: 12rpx;
  border: 1rpx solid #ffb300;
  box-shadow: 0 4rpx 12rpx rgba(255, 179, 0, 0.2);
  cursor: pointer;
}

.welcome-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.welcome-text {
  flex: 1;
  font-size: 26rpx;
  color: #5d4037;
  font-weight: 500;
}

.welcome-close {
  font-size: 36rpx;
  color: #6d4c41;
  flex-shrink: 0;
  line-height: 1;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left {
  flex: 1;
}

.header-right {
  flex-shrink: 1;
  min-width: 0;
  margin-left: 20rpx;
}

.login-btn {
  padding: 12rpx 30rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 30rpx;
}

.login-btn text {
  font-size: 26rpx;
  color: #fff;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15rpx;
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 40rpx;
  max-width: 320rpx;
  overflow: hidden;
}

.user-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar text {
  font-size: 26rpx;
  color: #fff;
  font-weight: bold;
}

.user-name {
  font-size: 26rpx;
  color: #fff;
  flex-shrink: 1;
  min-width: 0;
  max-width: 200rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.header-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.header-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 10rpx;
}

// 积分展示区
.points-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 30rpx;
  padding: 20rpx 25rpx;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.12));
  border-radius: 15rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
}

.points-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.points-icon {
  font-size: 36rpx;
}

.points-label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.points-right {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.points-value {
  font-size: 44rpx;
  font-weight: bold;
  color: #ffd700;
}

.points-unit {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.search-bar {
  display: flex;
  margin: 20rpx 30rpx 20rpx;
  background: #fff;
  border-radius: 40rpx;
  padding: 0 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.search-input {
  flex: 1;
  height: 80rpx;
  font-size: 28rpx;
}

.search-btn {
  padding: 0 30rpx;
  line-height: 80rpx;
  color: #667eea;
  font-size: 28rpx;
}

.category-tabs {
  padding: 0 30rpx;
  margin-bottom: 20rpx;
}

.tabs-scroll {
  white-space: nowrap;
}

.tab-item {
  display: inline-block;
  padding: 15rpx 30rpx;
  margin-right: 20rpx;
  background: #fff;
  border-radius: 30rpx;
  font-size: 28rpx;
  color: #666;
  
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.course-list {
  padding: 0 30rpx;
}

/* Grid 视图：两列网格 */
.course-list--grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

/* List 视图：单列（原有样式） */
.course-list--list {
  display: block;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.loading {
  text-align: center;
  padding: 40rpx;
  color: #999;
}

// ===== 猜你喜欢 =====
.recommend-section {
  margin: 0 30rpx 24rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f3f0ff 100%);
  border-radius: 20rpx;
  box-shadow: 0 6rpx 20rpx rgba(102, 126, 234, 0.12);
}

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.recommend-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #4a3f78;
  flex-shrink: 0;
}

.interest-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.interest-row {
  display: inline-flex;
  gap: 10rpx;
}

.interest-chip {
  padding: 6rpx 18rpx;
  background: #eef0ff;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #667eea;
  white-space: nowrap;
}

.recommend-scroll {
  white-space: nowrap;
}

.recommend-row {
  display: inline-flex;
  gap: 20rpx;
}

.recommend-item {
  position: relative;
  width: 220rpx;
  flex-shrink: 0;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.rec-cover {
  width: 220rpx;
  height: 140rpx;
  display: block;
}

.rec-cover--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  background: linear-gradient(135deg, #eef0ff 0%, #e8e0ff 100%);
}

.rec-badge {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  color: #fff;
}

.rec-badge-free {
  background: rgba(76, 175, 80, 0.9);
}

.rec-badge-points {
  background: rgba(255, 152, 0, 0.9);
}

.rec-badge-paid {
  background: rgba(102, 126, 234, 0.9);
}

.rec-title {
  display: block;
  padding: 14rpx 16rpx 4rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rec-meta {
  display: block;
  padding: 0 16rpx 14rpx;
  font-size: 22rpx;
  color: #999;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rec-activity {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed #ddd6ff;
}

.rec-activity-title {
  font-size: 24rpx;
  color: #9b8fd6;
  font-weight: 600;
}

.rec-activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 8rpx 0;
}

.rec-activity-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #444;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rec-activity-meta {
  flex-shrink: 0;
  padding: 4rpx 16rpx;
  background: #f4f1ff;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #8b7fd6;
}
</style>
