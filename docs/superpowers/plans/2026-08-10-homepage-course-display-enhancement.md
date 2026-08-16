# 首页课程显示增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 strapi-course 首页新增 Grid/List 双视图、5 种排序、快捷芯片+筛选弹层过滤、已选条件展示与状态持久化。

**Architecture:** 自下而上分层实现——先扩展 API 层（参数+查询组装），再依次构建 5 个独立组件（CourseCard → SortBar → FilterChips → FilterDrawer → ActiveFilters），最后在 index.vue 编排集成并接入状态持久化。每层可独立测试。

**Tech Stack:** Vue 3 Composition API + `<script setup lang="ts">` + UniApp（H5/小程序双端）+ Strapi v5 REST API（`sort` + `filters[$and]`）。

**Spec:** `docs/superpowers/specs/2026-08-10-homepage-course-display-enhancement-design.md`

---

## 文件结构

```
strapi-course/
├── services/
│   └── api.ts                              # 修改：扩展 getCourseList 参数 + 新增 getTags API
├── utils/
│   └── course-query.ts                     # 新建：sort 映射 + filters 组装 + URL query 构建/解析
├── components/
│   ├── course-card/
│   │   └── course-card.vue                 # 新建：课程卡片（grid/list 双模式）
│   ├── course-sort-bar/
│   │   └── course-sort-bar.vue             # 新建：排序选项 + 视图切换
│   ├── course-filter-chips/
│   │   └── course-filter-chips.vue         # 新建：常驻快捷过滤芯片
│   ├── course-filter-drawer/
│   │   └── course-filter-drawer.vue        # 新建：筛选弹层（难度/语言/价格/标签）
│   └── course-active-filters/
│       └── course-active-filters.vue       # 新建：已选条件展示 + 结果计数 + 空状态
├── pages/index/
│   └── index.vue                           # 修改：编排所有组件 + 状态持久化
├── jest.config.js                          # 修改：新增 unit 测试匹配规则
└── tests/
    └── unit/
        └── course-query.test.ts            # 新建：查询构建单元测试（纯 TS，无 Vue 依赖）
```

**注意**：CourseCard 组件测试改为手动验证（项目未安装 `@vue/test-utils`，避免引入新依赖）。

---

## Task 0: 环境准备 — jest 配置更新

**Files:**
- Modify: `strapi-course/jest.config.js`

**卡点说明**：现有 jest.config.js 的 testMatch 只匹配 `tests/e2e/**/*.test.ts`，不匹配 unit 测试。需要扩展匹配规则，同时保留 e2e 配置。

- [ ] **Step 1: 更新 jest.config.js 支持 unit 测试**

将 `strapi-course/jest.config.js` 替换为：

```javascript
module.exports = {
  preset: '@dcloudio/uni-automator',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.ts',
    '<rootDir>/tests/unit/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
}
```

- [ ] **Step 2: 验证现有 e2e 测试仍能被发现**

Run: `cd strapi-course && npx jest --listTests`
Expected: 列出 tests/e2e/ 和 tests/unit/ 下的测试文件（unit 目录暂时为空，不影响）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add jest.config.js
git commit -m "chore(test): support unit tests in jest config"
```

---

## Task 1: 扩展 API 层 — getCourseList 参数 + getTags API + 查询构建

**Files:**
- Create: `strapi-course/utils/course-query.ts`
- Modify: `strapi-course/services/api.ts:297-320`（getCourseList）+ 新增 getTags 函数

**卡点说明**：计划中使用了 `tagList`，但 api.ts 没有获取标签的 API。后端 zhao-tag 插件已提供公开路由 `GET /zhao-tag/v1/tags`（见 `plugins/zhao-tag/server/src/routes/content-api.ts:32`），需新增 getTags 函数。

- [ ] **Step 1: 创建 course-query.ts 工具模块**

新建 `strapi-course/utils/course-query.ts`：

```typescript
// strapi-course/utils/course-query.ts
// 课程列表查询参数构建工具

/** 排序 key 类型 */
export type SortKey = 'default' | 'newest' | 'hot' | 'price_asc' | 'price_desc' | 'rating'

/** 价格类型 */
export type PriceType = 'all' | 'free' | 'paid' | 'featured'

/** 完整过滤状态 */
export interface CourseFilterState {
  difficulty: string[]
  language: string[]
  priceRange: [number, number]
  tags: string[]
}

/** 默认过滤状态 */
export const DEFAULT_FILTER_STATE: CourseFilterState = {
  difficulty: [],
  language: [],
  priceRange: [0, 999],
  tags: []
}

/** 排序 key → Strapi v5 sort 参数映射 */
export const SORT_MAP: Record<SortKey, string> = {
  default: 'isFeatured:desc,sort:asc,publishDate:asc,createdAt:asc',
  newest: 'publishDate:desc,createdAt:desc',
  hot: 'studentCount:desc',
  price_asc: 'discountPrice:asc,originalPrice:asc',
  price_desc: 'discountPrice:desc,originalPrice:desc',
  rating: 'rating:desc,ratingCount:desc'
}

/** 视图模式 */
export type ViewMode = 'grid' | 'list'

/** 难度选项 */
export const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高级' },
  { value: 'expert', label: '专家' }
]

/** 语言选项 */
export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' }
]

/** 快捷芯片选项 */
export const PRICE_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'free', label: '免费' },
  { value: 'paid', label: '付费' },
  { value: 'featured', label: '⭐精选' }
]

/** 排序选项（showRating=false 时过滤掉评分） */
export function getSortOptions(showRating = false) {
  const all = [
    { key: 'default', label: '综合推荐' },
    { key: 'newest', label: '最新发布' },
    { key: 'hot', label: '最热' },
    { key: 'price_asc', label: '价格 ↑' },
    { key: 'price_desc', label: '价格 ↓' },
    { key: 'rating', label: '评分最高' }
  ]
  return showRating ? all : all.filter(o => o.key !== 'rating')
}

/**
 * 构建课程列表查询参数（转换为 Strapi v5 REST 格式）
 */
export interface CourseListParams {
  page?: number
  pageSize?: number
  category?: string
  q?: string
  status?: string
  sort?: SortKey
  priceType?: PriceType
  difficulty?: string[]
  language?: string[]
  minPrice?: number
  maxPrice?: number
  tags?: string[]
}

/**
 * 将前端参数转为 Strapi v5 REST 查询参数对象
 * 返回的对象可直接用 URLSearchParams 拼接
 */
export function buildCourseQuery(params: CourseListParams): Record<string, string> {
  const query: Record<string, string> = {}
  let andIndex = 0

  // 分类（已有逻辑）
  if (params.category && params.category !== 'all') {
    query['filters[category][documentId][$eq]'] = params.category
  }

  // 搜索（已有逻辑）
  if (params.q) {
    query['filters[title][$containsi]'] = params.q
  }

  // 排序
  if (params.sort) {
    query['sort'] = SORT_MAP[params.sort]
  }

  // 价格类型
  if (params.priceType && params.priceType !== 'all') {
    const fieldMap: Record<string, string> = {
      free: 'isFree',
      paid: 'isPaid',
      featured: 'isFeatured'
    }
    const field = fieldMap[params.priceType]
    if (field) {
      query[`filters[$and][${andIndex}][${field}][$eq]`] = 'true'
      andIndex++
    }
  }

  // 难度（多选）
  if (params.difficulty && params.difficulty.length > 0) {
    query[`filters[$and][${andIndex}][difficulty][$in]`] = params.difficulty.join(',')
    andIndex++
  }

  // 语言（多选）
  if (params.language && params.language.length > 0) {
    query[`filters[$and][${andIndex}][language][$in]`] = params.language.join(',')
    andIndex++
  }

  // 价格区间
  const minPrice = params.minPrice ?? 0
  const maxPrice = params.maxPrice ?? 999
  if (minPrice > 0) {
    query[`filters[$and][${andIndex}][discountPrice][$gte]`] = String(minPrice)
    andIndex++
  }
  if (maxPrice < 999) {
    query[`filters[$and][${andIndex}][discountPrice][$lte]`] = String(maxPrice)
    andIndex++
  }

  // 标签（多选，relation）
  if (params.tags && params.tags.length > 0) {
    query['filters[tags][documentId][$in]'] = params.tags.join(',')
  }

  // 分页
  if (params.page) query['pagination[page]'] = String(params.page)
  if (params.pageSize) query['pagination[pageSize]'] = String(params.pageSize)

  return query
}

/**
 * 将查询参数对象转为 URL query 字符串
 */
export function stringifyQuery(query: Record<string, string>): string {
  const params = new URLSearchParams(query)
  return params.toString()
}

/**
 * 构建 URL query 字符串用于状态持久化（前端可读格式，非 Strapi 格式）
 */
export function buildUrlQuery(state: {
  viewMode: ViewMode
  sort: SortKey
  category: string
  priceType: PriceType
  filter: CourseFilterState
  q?: string
}): string {
  const params = new URLSearchParams()
  params.set('view', state.viewMode)
  params.set('sort', state.sort)
  params.set('category', state.category)
  params.set('priceType', state.priceType)
  if (state.filter.difficulty.length > 0) {
    params.set('difficulty', state.filter.difficulty.join(','))
  }
  if (state.filter.language.length > 0) {
    params.set('lang', state.filter.language.join(','))
  }
  if (state.filter.priceRange[0] > 0) {
    params.set('min_price', String(state.filter.priceRange[0]))
  }
  if (state.filter.priceRange[1] < 999) {
    params.set('max_price', String(state.filter.priceRange[1]))
  }
  if (state.filter.tags.length > 0) {
    params.set('tags', state.filter.tags.join(','))
  }
  if (state.q) {
    params.set('q', state.q)
  }
  return params.toString()
}

/**
 * 从 URL query 字符串解析状态（用于 H5 刷新恢复）
 */
export function parseUrlQuery(queryStr: string): {
  viewMode?: ViewMode
  sort?: SortKey
  category?: string
  priceType?: PriceType
  filter?: Partial<CourseFilterState>
  q?: string
} {
  const params = new URLSearchParams(queryStr)
  const result: any = {}

  const view = params.get('view')
  if (view === 'grid' || view === 'list') result.viewMode = view

  const sort = params.get('sort')
  if (sort && sort in SORT_MAP) result.sort = sort as SortKey

  const category = params.get('category')
  if (category) result.category = category

  const priceType = params.get('priceType')
  if (priceType && ['all', 'free', 'paid', 'featured'].includes(priceType)) {
    result.priceType = priceType as PriceType
  }

  const difficulty = params.get('difficulty')
  if (difficulty) result.filter = { difficulty: difficulty.split(',') }

  const lang = params.get('lang')
  if (lang) {
    result.filter = { ...(result.filter || {}), language: lang.split(',') }
  }

  const minPrice = params.get('min_price')
  const maxPrice = params.get('max_price')
  if (minPrice || maxPrice) {
    const range: [number, number] = [
      minPrice ? Number(minPrice) : 0,
      maxPrice ? Number(maxPrice) : 999
    ]
    result.filter = { ...(result.filter || {}), priceRange: range }
  }

  const tags = params.get('tags')
  if (tags) {
    result.filter = { ...(result.filter || {}), tags: tags.split(',') }
  }

  const q = params.get('q')
  if (q) result.q = q

  return result
}
```

- [ ] **Step 2: 修改 services/api.ts 的 getCourseList + 新增 getTags**

将 `strapi-course/services/api.ts:297-320` 的 `getCourseList` 替换为：

```typescript
import {
  buildCourseQuery,
  stringifyQuery,
  type CourseListParams
} from '../utils/course-query'

export async function getCourseList(params?: CourseListParams) {
  const queryParams = params ? buildCourseQuery(params) : {}
  const query = stringifyQuery(queryParams)
  return request(`/zhao-course/v1/courses${query ? '?' + query : ''}`)
}
```

在 `getCourseCategories` 函数后新增 `getTags` 函数（后端公开路由 `GET /zhao-tag/v1/tags`）：

```typescript
export interface Tag {
  documentId: string
  name: string
  color?: string
}

export async function getTags() {
  return request('/zhao-tag/v1/tags?pagination[pageSize]=100')
}
```

注意：保留文件顶部原有的 `import { getToken, removeToken, removeUser, setPoints } from '../utils/storage'` 和 `import { BASE_API } from '../utils/env'` 不变，新增的 import 放在合适位置。

- [ ] **Step 3: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 4: Commit**

```bash
cd strapi-course
git add utils/course-query.ts services/api.ts
git commit -m "feat(course): extend getCourseList with sort/filter params and add getTags API"
```

---

## Task 2: CourseCard 组件 — Grid/List 双模式卡片

**Files:**
- Create: `strapi-course/components/course-card/course-card.vue`

**测试策略**：手动验证（项目未安装 `@vue/test-utils`，避免引入新依赖。组件逻辑简单，手动验证足够）。

- [ ] **Step 1: 创建 CourseCard 组件**

新建 `strapi-course/components/course-card/course-card.vue`：

```vue
<template>
  <view
    :class="['course-card', `course-card--${mode}`]"
    @click="$emit('click', course.documentId)"
  >
    <!-- 封面区 -->
    <view class="course-cover">
      <image
        v-if="course.cover?.url"
        :src="getImageUrl(course.cover.url)"
        mode="aspectFill"
        class="cover-image"
        lazy-load
      />
      <view v-else class="cover-placeholder">📚</view>

      <!-- 付费/免费标签 -->
      <view class="course-badge">
        <text v-if="course.isPaid && !course.isFree" class="badge-paid">付费</text>
        <text v-else-if="course.isFree" class="badge-free">免费</text>
      </view>

      <!-- 积分标签 -->
      <view v-if="course.enablePoints && course.points > 0" class="points-badge">
        <text>+{{ course.points }}积分</text>
      </view>
    </view>

    <!-- 信息区 -->
    <view class="course-info">
      <text class="course-title">{{ course.title }}</text>
      <text v-if="mode === 'list'" class="course-desc">{{ course.description || '暂无课程描述' }}</text>

      <!-- 元信息 -->
      <view class="course-meta">
        <view class="meta-left">
          <text class="meta-item">📖 {{ course.category?.name || '综合' }}</text>
          <text class="meta-item" v-if="course.difficulty">🎯 {{ getDifficultyText(course.difficulty) }}</text>
        </view>
        <text class="meta-item" v-if="course.studentCount">👥 {{ formatCount(course.studentCount) }}</text>
      </view>

      <!-- 操作按钮（仅 list 模式显示） -->
      <view v-if="mode === 'list'" class="course-action">
        <text class="action-btn">
          {{ course.isPaid && !course.isFree ? '立即购买' : '开始学习' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { getImageUrl } from '../../utils/env'
import type { Course } from '../../services/api'

defineProps<{
  course: Course
  mode: 'grid' | 'list'
}>()

defineEmits<{
  (e: 'click', documentId: string): void
}>()

function getDifficultyText(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
    expert: '专家'
  }
  return map[difficulty] || difficulty
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
</script>

<style lang="scss" scoped>
.course-card {
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

/* Grid 模式：封面在上 */
.course-card--grid {
  display: flex;
  flex-direction: column;
}

.course-card--grid .course-cover {
  width: 100%;
  height: 200rpx;
  background: #f5f5f5;
  position: relative;
}

/* List 模式：封面在左 */
.course-card--list {
  display: flex;
}

.course-card--list .course-cover {
  width: 220rpx;
  height: 180rpx;
  background: #f5f5f5;
  flex-shrink: 0;
  position: relative;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 70rpx;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
}

.course-badge {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
}

.badge-paid, .badge-free {
  display: inline-block;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  border-radius: 8rpx;
}

.badge-paid {
  background: #ff6b6b;
  color: #fff;
}

.badge-free {
  background: #51cf66;
  color: #fff;
}

.points-badge {
  position: absolute;
  bottom: 10rpx;
  right: 10rpx;
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;

  text {
    font-size: 20rpx;
    color: #333;
    font-weight: bold;
  }
}

.course-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.course-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.course-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
  flex-wrap: wrap;
  gap: 10rpx;
}

.meta-left {
  display: flex;
  gap: 15rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #666;
}

.course-action {
  margin-top: 15rpx;
}

.action-btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 12rpx 30rpx;
  border-radius: 25rpx;
  font-size: 26rpx;
}
</style>
```

- [ ] **Step 2: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add components/course-card/
git commit -m "feat(course): add CourseCard component with grid/list modes"
```

---

## Task 3: CourseSortBar 组件 — 排序 + 视图切换

**Files:**
- Create: `strapi-course/components/course-sort-bar/course-sort-bar.vue`

- [ ] **Step 1: 创建 CourseSortBar 组件**

新建 `strapi-course/components/course-sort-bar/course-sort-bar.vue`：

```vue
<template>
  <view class="sort-bar">
    <!-- 排序选项（横滚） -->
    <scroll-view scroll-x class="sort-scroll">
      <view class="sort-list">
        <view
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['sort-item', { active: modelValue === opt.key }]"
          @click="$emit('update:modelValue', opt.key)"
        >
          <text>{{ opt.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 视图切换图标 -->
    <view class="view-toggle">
      <view
        :class="['toggle-btn', { active: viewMode === 'grid' }]"
        @click="$emit('update:viewMode', 'grid')"
      >
        <text>⊞</text>
      </view>
      <view
        :class="['toggle-btn', { active: viewMode === 'list' }]"
        @click="$emit('update:viewMode', 'list')"
      >
        <text>☰</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getSortOptions, type SortKey, type ViewMode } from '../../utils/course-query'

const props = withDefaults(defineProps<{
  modelValue: SortKey
  viewMode: ViewMode
  showRating?: boolean
}>(), {
  showRating: false
})

defineEmits<{
  (e: 'update:modelValue', value: SortKey): void
  (e: 'update:viewMode', value: ViewMode): void
}>()

const sortOptions = computed(() => getSortOptions(props.showRating))
</script>

<style lang="scss" scoped>
.sort-bar {
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  margin-bottom: 20rpx;
  gap: 20rpx;
}

.sort-scroll {
  flex: 1;
  white-space: nowrap;
}

.sort-list {
  display: inline-flex;
  gap: 16rpx;
}

.sort-item {
  display: inline-block;
  padding: 10rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  border: 1rpx solid #eee;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-color: transparent;
  }
}

.view-toggle {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}

.toggle-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12rpx;
  border: 1rpx solid #eee;

  text {
    font-size: 32rpx;
    color: #999;
  }

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: transparent;

    text {
      color: #fff;
    }
  }
}
</style>
```

- [ ] **Step 2: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add components/course-sort-bar/
git commit -m "feat(course): add CourseSortBar component with view toggle"
```

---

## Task 4: CourseFilterChips 组件 — 常驻快捷过滤

**Files:**
- Create: `strapi-course/components/course-filter-chips/course-filter-chips.vue`

- [ ] **Step 1: 创建 CourseFilterChips 组件**

新建 `strapi-course/components/course-filter-chips/course-filter-chips.vue`：

```vue
<template>
  <view class="filter-chips">
    <!-- 快捷芯片（互斥单选） -->
    <view
      v-for="opt in PRICE_TYPE_OPTIONS"
      :key="opt.value"
      :class="['chip', { active: modelValue === opt.value }]"
      @click="$emit('update:modelValue', opt.value)"
    >
      <text>{{ opt.label }}</text>
    </view>

    <!-- 筛选按钮（打开弹层） -->
    <view class="chip chip-filter" @click="$emit('open-drawer')">
      <text>▦ 筛选</text>
      <view v-if="activeFilterCount > 0" class="filter-badge">
        <text>{{ activeFilterCount }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PRICE_TYPE_OPTIONS, type PriceType, type CourseFilterState } from '../../utils/course-query'

const props = defineProps<{
  modelValue: PriceType
  filterState: CourseFilterState
}>()

defineEmits<{
  (e: 'update:modelValue', value: PriceType): void
  (e: 'open-drawer'): void
}>()

/** 弹层内已选条件数量（用于角标显示） */
const activeFilterCount = computed(() => {
  let count = 0
  if (props.filterState.difficulty.length > 0) count += props.filterState.difficulty.length
  if (props.filterState.language.length > 0) count += props.filterState.language.length
  if (props.filterState.priceRange[0] > 0 || props.filterState.priceRange[1] < 999) count += 1
  if (props.filterState.tags.length > 0) count += props.filterState.tags.length
  return count
})
</script>

<style lang="scss" scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 30rpx;
  margin-bottom: 16rpx;
}

.chip {
  display: inline-block;
  padding: 10rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #666;
  border: 1rpx solid #eee;
  position: relative;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-color: transparent;
  }
}

.chip-filter {
  margin-left: auto;
  color: #667eea;
  border-color: #667eea;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
}

.filter-badge {
  min-width: 28rpx;
  height: 28rpx;
  background: #ff6b6b;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    font-size: 18rpx;
    color: #fff;
    line-height: 1;
  }
}
</style>
```

- [ ] **Step 2: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add components/course-filter-chips/
git commit -m "feat(course): add CourseFilterChips component"
```

---

## Task 5: CourseFilterDrawer 组件 — 筛选弹层

**Files:**
- Create: `strapi-course/components/course-filter-drawer/course-filter-drawer.vue`

- [ ] **Step 1: 创建 CourseFilterDrawer 组件**

新建 `strapi-course/components/course-filter-drawer/course-filter-drawer.vue`：

```vue
<template>
  <!-- 遮罩层 -->
  <view v-if="visible" class="drawer-mask" @click="$emit('update:visible', false)">
    <!-- 弹层主体 -->
    <view class="drawer" @click.stop>
      <!-- 头部 -->
      <view class="drawer-header">
        <text class="drawer-title">筛选</text>
        <text class="drawer-close" @click="$emit('update:visible', false)">×</text>
      </view>

      <!-- 内容区 -->
      <scroll-view scroll-y class="drawer-body">
        <!-- 难度 -->
        <view class="filter-section">
          <text class="section-title">难度</text>
          <view class="checkbox-group">
            <view
              v-for="opt in DIFFICULTY_OPTIONS"
              :key="opt.value"
              :class="['checkbox-item', { checked: localState.difficulty.includes(opt.value) }]"
              @click="toggleArray('difficulty', opt.value)"
            >
              <text>{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 语言 -->
        <view class="filter-section">
          <text class="section-title">语言</text>
          <view class="checkbox-group">
            <view
              v-for="opt in LANGUAGE_OPTIONS"
              :key="opt.value"
              :class="['checkbox-item', { checked: localState.language.includes(opt.value) }]"
              @click="toggleArray('language', opt.value)"
            >
              <text>{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 价格区间 -->
        <view class="filter-section">
          <text class="section-title">价格区间</text>
          <view class="price-range">
            <input
              class="price-input"
              type="number"
              :value="localState.priceRange[0]"
              placeholder="最低"
              @input="updatePrice(0, $event)"
            />
            <text class="price-separator">—</text>
            <input
              class="price-input"
              type="number"
              :value="localState.priceRange[1]"
              placeholder="最高"
              @input="updatePrice(1, $event)"
            />
          </view>
        </view>

        <!-- 标签 -->
        <view class="filter-section">
          <text class="section-title">标签</text>
          <view v-if="tags.length === 0" class="empty-tags">
            <text>暂无标签</text>
          </view>
          <view v-else class="checkbox-group">
            <view
              v-for="tag in tags"
              :key="tag.documentId"
              :class="['checkbox-item', { checked: localState.tags.includes(tag.documentId) }]"
              @click="toggleArray('tags', tag.documentId)"
            >
              <text>{{ tag.name }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 底部操作 -->
      <view class="drawer-footer">
        <view class="footer-btn footer-reset" @click="handleReset">
          <text>重置</text>
        </view>
        <view class="footer-btn footer-apply" @click="handleApply">
          <text>确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  DEFAULT_FILTER_STATE,
  type CourseFilterState
} from '../../utils/course-query'
import type { Tag } from '../../services/api'

const props = defineProps<{
  visible: boolean
  modelValue: CourseFilterState
  tags: Tag[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'apply', value: CourseFilterState): void
  (e: 'reset'): void
}>()

// 本地副本（编辑中不立即触发外部更新，点确定才 apply）
const localState = ref<CourseFilterState>({ ...DEFAULT_FILTER_STATE })

// 弹层打开时同步外部值
watch(() => props.visible, (v) => {
  if (v) {
    localState.value = JSON.parse(JSON.stringify(props.modelValue))
  }
})

function toggleArray(field: 'difficulty' | 'language' | 'tags', value: string) {
  const arr = localState.value[field]
  const idx = arr.indexOf(value)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    arr.push(value)
  }
}

function updatePrice(index: 0 | 1, e: any) {
  const val = Number(e.detail.value) || 0
  let range: [number, number] = [...localState.value.priceRange]
  range[index] = val
  // 自动交换 min > max
  if (range[0] > range[1]) {
    range = [range[1], range[0]]
  }
  localState.value.priceRange = range
}

function handleApply() {
  emit('apply', JSON.parse(JSON.stringify(localState.value)))
  emit('update:visible', false)
}

function handleReset() {
  localState.value = JSON.parse(JSON.stringify(DEFAULT_FILTER_STATE))
  emit('reset')
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.drawer {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.drawer-close {
  font-size: 40rpx;
  color: #999;
  line-height: 1;
}

.drawer-body {
  flex: 1;
  padding: 20rpx 30rpx;
}

.filter-section {
  margin-bottom: 40rpx;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.checkbox-item {
  padding: 12rpx 28rpx;
  background: #f5f5f5;
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #666;

  &.checked {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.price-range {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.price-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 26rpx;
}

.price-separator {
  color: #999;
  font-size: 28rpx;
}

.empty-tags {
  padding: 30rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.drawer-footer {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx;
  border-top: 1rpx solid #eee;
}

.footer-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.footer-reset {
  background: #f5f5f5;
  color: #666;
}

.footer-apply {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
</style>
```

- [ ] **Step 2: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add components/course-filter-drawer/
git commit -m "feat(course): add CourseFilterDrawer component"
```

---

## Task 6: CourseActiveFilters 组件 — 已选条件 + 空状态

**Files:**
- Create: `strapi-course/components/course-active-filters/course-active-filters.vue`

- [ ] **Step 1: 创建 CourseActiveFilters 组件**

新建 `strapi-course/components/course-active-filters/course-active-filters.vue`：

```vue
<template>
  <!-- 有已选条件时显示 -->
  <view v-if="activeChips.length > 0" class="active-filters">
    <view class="chips-row">
      <text class="chips-label">已选：</text>
      <view
        v-for="chip in activeChips"
        :key="chip.type + chip.value"
        class="active-chip"
        @click="$emit('remove', { type: chip.type, value: chip.value })"
      >
        <text>{{ chip.label }}</text>
        <text class="chip-close">×</text>
      </view>
      <text class="clear-all" @click="$emit('clear-all')">清除全部</text>
      <text class="result-count">共 <text class="count-num">{{ total }}</text> 门</text>
    </view>
  </view>

  <!-- 无已选条件但有结果：只显示计数 -->
  <view v-else-if="hasResult" class="result-only">
    <text class="result-count">共 <text class="count-num">{{ total }}</text> 门课程</text>
  </view>

  <!-- 无结果：空状态 -->
  <view v-else class="empty-state">
    <text class="empty-icon">🔍</text>
    <text class="empty-text">没有符合条件的课程</text>
    <text class="empty-hint" @click="$emit('clear-all')">尝试减少筛选条件</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  type CourseFilterState,
  type PriceType
} from '../../utils/course-query'
import type { Tag } from '../../services/api'

const props = defineProps<{
  filters: CourseFilterState
  priceType: PriceType
  category: string
  categoryList: Array<{ id: string; name: string }>
  tags: Tag[]
  total: number
  hasResult: boolean
}>()

defineEmits<{
  (e: 'remove', payload: { type: string; value: string }): void
  (e: 'clear-all'): void
}>()

interface ActiveChip {
  type: string
  value: string
  label: string
}

const activeChips = computed<ActiveChip[]>(() => {
  const chips: ActiveChip[] = []

  // 价格类型（非 all）
  if (props.priceType !== 'all') {
    const labelMap: Record<string, string> = {
      free: '免费',
      paid: '付费',
      featured: '精选'
    }
    chips.push({ type: 'priceType', value: props.priceType, label: labelMap[props.priceType] || props.priceType })
  }

  // 分类（非 all）
  if (props.category !== 'all') {
    const cat = props.categoryList.find(c => c.id === props.category)
    if (cat) chips.push({ type: 'category', value: props.category, label: cat.name })
  }

  // 难度
  props.filters.difficulty.forEach(d => {
    const opt = DIFFICULTY_OPTIONS.find(o => o.value === d)
    if (opt) chips.push({ type: 'difficulty', value: d, label: opt.label })
  })

  // 语言
  props.filters.language.forEach(l => {
    const opt = LANGUAGE_OPTIONS.find(o => o.value === l)
    if (opt) chips.push({ type: 'language', value: l, label: opt.label })
  })

  // 价格区间（非默认）
  if (props.filters.priceRange[0] > 0 || props.filters.priceRange[1] < 999) {
    const [min, max] = props.filters.priceRange
    chips.push({ type: 'priceRange', value: 'range', label: `¥${min}-${max}` })
  }

  // 标签
  props.filters.tags.forEach(t => {
    const tag = props.tags.find(tg => tg.documentId === t)
    if (tag) chips.push({ type: 'tags', value: t, label: `#${tag.name}` })
  })

  return chips
})
</script>

<style lang="scss" scoped>
.active-filters {
  padding: 0 30rpx;
  margin-bottom: 16rpx;
}

.chips-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chips-label {
  font-size: 22rpx;
  color: #999;
}

.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  background: #667eea;
  color: #fff;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.chip-close {
  font-size: 24rpx;
  line-height: 1;
}

.clear-all {
  font-size: 22rpx;
  color: #ff6b6b;
  margin-left: 8rpx;
}

.result-count {
  margin-left: auto;
  font-size: 22rpx;
  color: #666;
}

.count-num {
  color: #667eea;
  font-weight: bold;
}

.result-only {
  padding: 0 30rpx;
  margin-bottom: 16rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 12rpx;
}

.empty-hint {
  font-size: 24rpx;
  color: #667eea;
}
</style>
```

- [ ] **Step 2: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 3: Commit**

```bash
cd strapi-course
git add components/course-active-filters/
git commit -m "feat(course): add CourseActiveFilters component"
```

---

## Task 7: index.vue 集成 — 编排所有组件 + 状态持久化

**Files:**
- Modify: `strapi-course/pages/index/index.vue`

- [ ] **Step 1: 重写 index.vue 的 template 课程列表区域**

将 `strapi-course/pages/index/index.vue` 的 template 中 `<!-- 分类标签 -->` 之后到 `<!-- 加载状态 -->` 之前的课程列表区域替换为：

```vue
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

    <!-- 快捷过滤芯片条（新增） -->
    <course-filter-chips
      v-model="priceType"
      :filter-state="filterState"
      @open-drawer="drawerVisible = true"
    />

    <!-- 排序 + 视图切换条（新增） -->
    <course-sort-bar
      v-model="sortKey"
      :view-mode="viewMode"
      :show-rating="false"
      @update:view-mode="handleViewModeChange"
    />

    <!-- 已选条件 + 结果计数 + 空状态（新增） -->
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

    <!-- 筛选弹层（新增） -->
    <course-filter-drawer
      v-model:visible="drawerVisible"
      v-model="filterState"
      :tags="tagList"
      @apply="handleApplyFilter"
      @reset="handleResetFilter"
    />
```

- [ ] **Step 2: 重写 index.vue 的 script setup**

将 `strapi-course/pages/index/index.vue` 的 `<script setup lang="ts">` 部分替换为：

```typescript
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCourseList, getPointBalance, getCourseCategories, getInviteStats, getTags } from '../../services/api'
import { validateLogin, getAuthUser, checkLogin } from '../../utils/auth'
import { getImageUrl } from '../../utils/env'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
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

// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
if (typeof window !== 'undefined' && isWechatBrowser()) {
  setupPageShare()
}
// #endif

// ===== 状态 =====
const searchKeyword = ref('')
const activeCategory = ref('all')
const courseList = ref<Course[]>([])
const loading = ref(false)
const user = ref<any>(null)
const pointBalance = ref(0)
const isLoggedIn = ref(false)
const inviteCode = ref('')
const siteConfig = ref<any>(null)
const showWelcome = ref(false)
let welcomeTimer: any = null

// 新增：视图/排序/过滤状态
const viewMode = ref<ViewMode>('grid')
const sortKey = ref<SortKey>('default')
const priceType = ref<PriceType>('all')
const filterState = ref<CourseFilterState>({ ...DEFAULT_FILTER_STATE })
const drawerVisible = ref(false)
const tagList = ref<Tag[]>([])
const totalCourses = ref(0)

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

// ===== 原有逻辑（保持不变） =====
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

async function loadInviteCode() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getInviteStats()
    inviteCode.value = res?.data?.inviteCode || ''
  } catch (e) {
    console.error('获取邀请码失败', e)
  }
}

async function loadPointBalance() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getPointBalance()
    pointBalance.value = res?.balance ?? res?.globalBalance ?? 0
  } catch (e) {
    console.error('获取积分失败', e)
  }
}

function goToProfile() {
  uni.switchTab({ url: '/pages/profile/profile' })
}

const categories = ref<Array<{ id: string; name: string }>>([
  { id: 'all', name: '全部' }
])

async function loadCategories() {
  try {
    const res: any = await getCourseCategories()
    const categoryList = res?.data || []
    const formattedCategories = categoryList.map((cat: any) => ({
      id: cat.documentId || cat.id,
      name: cat.name || '未命名分类'
    }))
    categories.value = [{ id: 'all', name: '全部' }, ...formattedCategories]
  } catch (e) {
    console.error('加载分类失败', e)
    categories.value = [
      { id: 'all', name: '全部' },
      { id: 'tech', name: '技术' },
      { id: 'language', name: '语言' },
      { id: 'art', name: '艺术' },
      { id: 'business', name: '商业' }
    ]
  }
}

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

async function loadCourses() {
  loading.value = true
  try {
    const res: any = await getCourseList({
      category: activeCategory.value,
      q: searchKeyword.value,
      sort: sortKey.value,
      priceType: priceType.value,
      difficulty: filterState.value.difficulty,
      language: filterState.value.language,
      minPrice: filterState.value.priceRange[0],
      maxPrice: filterState.value.priceRange[1],
      tags: filterState.value.tags
    })
    courseList.value = res?.data || []
    totalCourses.value = res?.meta?.pagination?.total || courseList.value.length
  } catch (e) {
    console.error('加载课程失败', e)
    courseList.value = []
    totalCourses.value = 0
  }
  loading.value = false
}

function handleCategoryChange(categoryId: string) {
  activeCategory.value = categoryId
  persistState()
  debouncedLoadCourses()
}

function handleSearch() {
  persistState()
  debouncedLoadCourses()
}

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
  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${id}` })
}

function goToLogin() {
  uni.removeStorageSync('isGuest')
  uni.navigateTo({ url: '/pages/login/login' })
}

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
  checkNewUserWelcome()
})

onShow(() => {
  refreshData()
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
  siteConfig.value = getStoredAuthConfig()
}

// 微信分享
onShareAppMessage(() => {
  const authConfig = getStoredAuthConfig()
  const sharePath = inviteCode.value
    ? `/pages/index/index?inviteCode=${inviteCode.value}`
    : authConfig?.sharePath ?? '/pages/index/index'
  return {
    title: authConfig?.shareTitle ?? '圣麟教育 - 学习课程，答题赢积分',
    path: sharePath,
    imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
  }
})

onShareTimeline(() => {
  const authConfig = getStoredAuthConfig()
  const shareQuery = inviteCode.value
    ? `inviteCode=${inviteCode.value}`
    : ''
  return {
    title: authConfig?.shareTitle ?? '圣麟教育 - 学习课程，答题赢积分！快来一起学习吧！',
    query: shareQuery,
    imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
  }
})
</script>
```

- [ ] **Step 3: 更新 style — 新增 Grid 视图样式**

在 `strapi-course/pages/index/index.vue` 的 `<style>` 中，将原有的 `.course-list` 样式替换为：

```scss
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
```

并删除原有的 `.course-card`、`.course-cover`、`.cover-image`、`.cover-placeholder`、`.course-badge`、`.badge-paid`、`.badge-free`、`.points-badge`、`.course-info`、`.course-title`、`.course-desc`、`.course-meta`、`.meta-left`、`.meta-item`、`.course-action`、`.action-btn` 等样式（已迁移到 CourseCard 组件中）。

保留 `.empty-state`、`.empty-icon`、`.empty-text`、`.loading` 样式。

- [ ] **Step 4: 验证编译通过**

Run: `cd strapi-course && npx tsc --noEmit`
Expected: 无类型错误（项目未安装 vue-tsc，使用 tsc 代替）

- [ ] **Step 5: 本地启动验证 UI**

Run: `cd strapi-course && npm run dev:h5`
Expected: 首页加载正常，显示 Grid 视图 + 排序条 + 过滤芯片 + 筛选按钮

- [ ] **Step 6: Commit**

```bash
cd strapi-course
git add pages/index/index.vue
git commit -m "feat(course): integrate view/sort/filter components into homepage"
```

---

## Task 8: course-query 单元测试 + 端到端验证

**Files:**
- Create: `strapi-course/tests/unit/course-query.test.ts`

- [ ] **Step 1: 创建 course-query 单元测试**

新建 `strapi-course/tests/unit/course-query.test.ts`：

```typescript
import {
  buildCourseQuery,
  buildUrlQuery,
  parseUrlQuery,
  SORT_MAP,
  DEFAULT_FILTER_STATE,
  getSortOptions,
  type CourseListParams
} from '../../utils/course-query'

describe('course-query', () => {
  describe('SORT_MAP', () => {
    it('contains all 6 sort keys', () => {
      expect(Object.keys(SORT_MAP)).toHaveLength(6)
      expect(SORT_MAP.default).toContain('isFeatured:desc')
      expect(SORT_MAP.default).toContain('publishDate:asc')
      expect(SORT_MAP.newest).toBe('publishDate:desc,createdAt:desc')
      expect(SORT_MAP.hot).toBe('studentCount:desc')
      expect(SORT_MAP.rating).toContain('rating:desc')
    })
  })

  describe('getSortOptions', () => {
    it('hides rating by default', () => {
      const options = getSortOptions()
      expect(options).toHaveLength(5)
      expect(options.find(o => o.key === 'rating')).toBeUndefined()
    })

    it('shows rating when showRating=true', () => {
      const options = getSortOptions(true)
      expect(options).toHaveLength(6)
      expect(options.find(o => o.key === 'rating')).toBeDefined()
    })
  })

  describe('buildCourseQuery', () => {
    it('returns empty object for empty params', () => {
      expect(buildCourseQuery({})).toEqual({})
    })

    it('maps sort key to Strapi sort param', () => {
      const query = buildCourseQuery({ sort: 'hot' })
      expect(query['sort']).toBe('studentCount:desc')
    })

    it('maps category filter', () => {
      const query = buildCourseQuery({ category: 'cat-123' })
      expect(query['filters[category][documentId][$eq]']).toBe('cat-123')
    })

    it('does not add category filter when "all"', () => {
      const query = buildCourseQuery({ category: 'all' })
      expect(query['filters[category][documentId][$eq]']).toBeUndefined()
    })

    it('maps priceType free', () => {
      const query = buildCourseQuery({ priceType: 'free' })
      expect(query['filters[$and][0][isFree][$eq]']).toBe('true')
    })

    it('maps priceType paid', () => {
      const query = buildCourseQuery({ priceType: 'paid' })
      expect(query['filters[$and][0][isPaid][$eq]']).toBe('true')
    })

    it('maps priceType featured', () => {
      const query = buildCourseQuery({ priceType: 'featured' })
      expect(query['filters[$and][0][isFeatured][$eq]']).toBe('true')
    })

    it('maps difficulty array to $in filter', () => {
      const query = buildCourseQuery({ difficulty: ['beginner', 'advanced'] })
      expect(query['filters[$and][0][difficulty][$in]']).toBe('beginner,advanced')
    })

    it('maps language array to $in filter', () => {
      const query = buildCourseQuery({ language: ['zh-CN', 'en-US'] })
      expect(query['filters[$and][0][language][$in]']).toBe('zh-CN,en-US')
    })

    it('maps price range', () => {
      const query = buildCourseQuery({ minPrice: 10, maxPrice: 100 })
      expect(query['filters[$and][0][discountPrice][$gte]']).toBe('10')
      expect(query['filters[$and][1][discountPrice][$lte]']).toBe('100')
    })

    it('maps tags to relation filter', () => {
      const query = buildCourseQuery({ tags: ['tag-1', 'tag-2'] })
      expect(query['filters[tags][documentId][$in]']).toBe('tag-1,tag-2')
    })

    it('combines multiple filters with incrementing $and index', () => {
      const query = buildCourseQuery({
        priceType: 'free',
        difficulty: ['beginner'],
        language: ['zh-CN']
      })
      expect(query['filters[$and][0][isFree][$eq]']).toBe('true')
      expect(query['filters[$and][1][difficulty][$in]']).toBe('beginner')
      expect(query['filters[$and][2][language][$in]']).toBe('zh-CN')
    })
  })

  describe('buildUrlQuery / parseUrlQuery', () => {
    it('round-trips a complete state', () => {
      const state = {
        viewMode: 'grid' as const,
        sort: 'hot' as const,
        category: 'cat-1',
        priceType: 'free' as const,
        filter: {
          difficulty: ['beginner', 'intermediate'],
          language: ['zh-CN'],
          priceRange: [10, 100] as [number, number],
          tags: ['tag-1']
        },
        q: 'python'
      }
      const queryStr = buildUrlQuery(state)
      const parsed = parseUrlQuery(queryStr)

      expect(parsed.viewMode).toBe('grid')
      expect(parsed.sort).toBe('hot')
      expect(parsed.category).toBe('cat-1')
      expect(parsed.priceType).toBe('free')
      expect(parsed.filter?.difficulty).toEqual(['beginner', 'intermediate'])
      expect(parsed.filter?.language).toEqual(['zh-CN'])
      expect(parsed.filter?.priceRange).toEqual([10, 100])
      expect(parsed.filter?.tags).toEqual(['tag-1'])
      expect(parsed.q).toBe('python')
    })

    it('omits default values from URL', () => {
      const queryStr = buildUrlQuery({
        viewMode: 'grid',
        sort: 'default',
        category: 'all',
        priceType: 'all',
        filter: DEFAULT_FILTER_STATE
      })
      // 默认值不应出现在 URL 中
      expect(queryStr).not.toContain('difficulty')
      expect(queryStr).not.toContain('min_price')
      expect(queryStr).not.toContain('tags')
    })

    it('ignores invalid sort values', () => {
      const parsed = parseUrlQuery('sort=invalid')
      expect(parsed.sort).toBeUndefined()
    })

    it('ignores invalid priceType values', () => {
      const parsed = parseUrlQuery('priceType=invalid')
      expect(parsed.priceType).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd strapi-course && npx jest tests/unit/course-query.test.ts`
Expected: 所有测试通过

- [ ] **Step 3: 运行全部测试确认无回归**

Run: `cd strapi-course && npx jest`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
cd strapi-course
git add tests/unit/course-query.test.ts
git commit -m "test(course): add unit tests for course-query utils"
```

---

## Task 9: 端到端手工验证

**Files:** 无（仅验证）

- [ ] **Step 1: 启动 H5 开发服务器**

Run: `cd strapi-course && npm run dev:h5`

- [ ] **Step 2: 验证视图切换**

打开浏览器访问首页：
- 默认显示 Grid 两列网格视图
- 点击 ☰ 切换到 List 单列视图
- 刷新页面，视图模式保持

- [ ] **Step 3: 验证排序**

- 点击「最新发布」，课程列表按 publishDate 降序
- 点击「最热」，按 studentCount 降序
- 点击「价格 ↑」/「价格 ↓」，按 discountPrice 排序
- 确认「评分最高」选项不显示在 UI 中

- [ ] **Step 4: 验证快捷过滤芯片**

- 点击「免费」，只显示 isFree=true 的课程
- 点击「付费」，只显示 isPaid=true 的课程
- 点击「精选」，只显示 isFeatured=true 的课程
- 点击「全部」，恢复全部课程
- 确认芯片互斥单选

- [ ] **Step 5: 验证筛选弹层**

- 点击「▦ 筛选」打开弹层
- 勾选难度「入门」+「进阶」，点确定
- 确认列表只显示对应难度课程
- 重新打开弹层，输入价格区间 0-50，点确定
- 确认列表按价格过滤
- 点「重置」，确认所有筛选清空

- [ ] **Step 6: 验证已选条件展示**

- 选中多个过滤条件后，确认已选条件胶囊正确显示
- 点击某个胶囊的 ×，确认单个条件移除
- 点击「清除全部」，确认所有条件清空
- 制造无结果场景（如价格 999-999），确认空状态插图显示

- [ ] **Step 7: 验证 URL 持久化（H5）**

- 设置一组过滤条件
- 复制浏览器 URL，新标签页打开
- 确认过滤状态完全恢复
- 确认 URL 参数包含 view/sort/category/priceType/difficulty 等

- [ ] **Step 8: 验证兼容性**

- 确认现有分类标签切换正常
- 确认搜索栏输入关键词 + 回车正常过滤
- 确认 Header 积分展示正常
- 确认公告栏 + 广告轮播正常
- 确认登录/分享功能不受影响

- [ ] **Step 9: 最终 Commit**

```bash
cd strapi-course
git add -A
git commit -m "feat(course): complete homepage display enhancement with tests"
```

---

## Self-Review Checklist

**1. Spec coverage**（对照设计文档）：
- ✅ 视图模式 Grid+List — Task 2, 7
- ✅ 排序 5 选项 + 评分隐藏 — Task 1 (SORT_MAP), Task 3 (showRating)
- ✅ 默认排序 isFeatured→sort→publishDate ASC — Task 1 (SORT_MAP.default)
- ✅ 快捷芯片 全部/免费/付费/精选 — Task 4
- ✅ 筛选弹层 难度/语言/价格/标签 — Task 5
- ✅ 已选条件 + 空状态 — Task 6
- ✅ URL query + localStorage 持久化 — Task 1 (buildUrlQuery/parseUrlQuery), Task 7 (restoreState/persistState)
- ✅ API getCourseList 参数扩展 — Task 1
- ✅ API getTags 新增（卡点修复）— Task 1
- ✅ 防抖 300ms — Task 7 (debouncedLoadCourses)
- ✅ 组件拆分 5 个 — Task 2-6
- ✅ jest 配置支持 unit 测试（卡点修复）— Task 0

**2. 卡点修复清单**：
- ✅ 缺失 `@vue/test-utils` → CourseCard 改为手动验证，不引入新依赖
- ✅ 缺失 `vue-tsc` → 所有类型检查改用 `npx tsc --noEmit`
- ✅ jest.config.js 不匹配 unit 测试 → Task 0 扩展 testMatch
- ✅ 缺失 getTags API → Task 1 新增，后端已有公开路由 `GET /zhao-tag/v1/tags`
- ✅ uni-automator preset → 保留（兼容 e2e），unit 测试用纯 ts-jest transform

**3. Placeholder scan**：无 TBD/TODO，所有代码步骤含完整代码。

**4. Type consistency**：
- `SortKey` / `ViewMode` / `PriceType` / `CourseFilterState` 在 Task 1 定义，Task 2-7 引用一致
- `Tag` 接口在 Task 1 (api.ts) 定义并 export，Task 5/6/7 从 `../../services/api` 导入一致
- `CourseListParams` 在 Task 1 定义，Task 7 调用 getCourseList 时参数名一致
- `getSortOptions` 函数名在 Task 1 定义，Task 3 引用一致

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-08-10-homepage-course-display-enhancement.md`。卡点已全部修复，直接进入 Subagent-Driven 执行模式。
