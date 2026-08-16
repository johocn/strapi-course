# 首页课程显示增强设计文档

> 日期: 2026-08-10
> 状态: 已批准

## 1. 概述

在 strapi-course 首页（`pages/index/index.vue`）现有「搜索栏 + 分类标签 + 单卡片列表」基础上，增强课程展示能力：

- **视图模式**：新增 Grid 网格 / List 列表两种视图，用户可切换并记忆偏好
- **排序方式**：新增 5 种排序选项（综合推荐/最新发布/最热/价格升降序），评分排序代码实现但 UI 暂隐藏
- **过滤方式**：新增常驻快捷芯片条 + 筛选弹层（难度/语言/价格区间/标签）
- **状态显示**：已选条件胶囊 + 结果计数 + 空状态友好提示
- **状态持久化**：URL query（H5 可分享）+ localStorage（小程序场景）

### 现有系统状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 首页 `pages/index/index.vue` | 已就绪 | Header + 公告 + 广告 + 搜索 + 分类标签 + 横向卡片列表 |
| API `getCourseList` | 部分就绪 | 支持 category/q/page/pageSize，**未传 sort/多字段过滤参数** |
| 后端 zhao-course Course schema | 已就绪 | 含 sort、publishDate、studentCount、viewCount、rating、difficulty、level、language、isFree、isPaid、isFeatured、originalPrice、discountPrice、tags 等字段 |
| 后端 Strapi v5 REST API | 已就绪 | 标准 `sort` + `filters[$and]` 查询语法 |
| 分类标签 | 已就绪 | `getCourseCategories` + 横滚 tab |
| 搜索 | 已就绪 | `q` 参数 → `filters[title][$containsi]` |
| 视图切换/排序/过滤 UI | 缺失 | 当前只有单一卡片视图 |
| 组件拆分 | 缺失 | 课程卡片内联在 index.vue，未抽取 |

## 2. 方案选择

### 视图模式：Grid + List 双视图（选定）

两种视图都实现，默认 Grid，右上角图标切换，localStorage 记忆。

- 优点：覆盖浏览发现（Grid）和详细阅读（List）两种场景，符合慕课网/腾讯课堂主流模式
- 缺点：需维护两套卡片样式
- 改动：抽取 `CourseCard.vue` 组件，支持 `mode` prop

### 排序方式：5 选项 + 评分隐藏（选定）

| 排序选项 | 后端 sort 参数 | 说明 |
|---------|---------------|------|
| 综合推荐（默认） | `isFeatured:desc,sort:asc,publishDate:asc` | 精品置顶 → 手动权重 → 最早发布兜底 |
| 最新发布 | `publishDate:desc` | 回退 `createdAt:desc` |
| 最热 | `studentCount:desc` | 学习人数降序 |
| 价格升序 | `discountPrice:asc` | 回退 `originalPrice:asc` |
| 价格降序 | `discountPrice:desc` | 回退 `originalPrice:desc` |
| 评分最高（隐藏） | `rating:desc,ratingCount:desc` | 代码实现但 UI 隐藏，后续有评分数据再显示 |

- 优点：覆盖用户主流排序需求，评分排序预留扩展
- 缺点：评分排序暂不可用（rating 默认 0）

### 过滤方式：快捷芯片 + 筛选抽屉（选定）

- **常驻芯片条**（高频，互斥单选）：全部 / 免费 / 付费 / 精选
- **筛选弹层**（低频，多选 + 重置 + 确定）：难度 / 语言 / 价格区间 / 标签

优点：常驻区快速操作，弹层区承载完整筛选能力，支持组合查询，符合电商 App 标准模式。

### 状态显示：已选条件行 + 空状态（选定）

- 有结果：已选条件胶囊（带 × 移除）+ 清除全部 + "共 N 门课程"
- 无结果：空状态插图 + "没有符合条件的课程，尝试减少筛选条件"

### 状态持久化：URL query + localStorage（选定）

- H5：URL query 参数（可分享/刷新保持）
- 小程序：localStorage（返回首页恢复）

## 3. 数据模型

### 3.1 查询参数设计

前端 → 后端 API 查询参数映射：

| 前端参数 | 后端 Strapi v5 查询参数 | 说明 |
|---------|----------------------|------|
| `view` | （仅前端，不传后端） | grid \| list |
| `sort` | `sort=<字段>:<方向>,<字段>:<方向>` | default \| newest \| hot \| price_asc \| price_desc \| rating |
| `category` | `filters[category][documentId][$eq]=<id>` | 已有 |
| `q` | `filters[title][$containsi]=<keyword>` | 已有 |
| `priceType` | 见下方 | free \| paid \| featured |
| `difficulty` | `filters[$and][0][difficulty][$in]=beginner&...` | 多选 |
| `language` | `filters[$and][1][language][$in]=zh-CN&...` | 多选 |
| `min_price` | `filters[$and][2][discountPrice][$gte]=<n>` | 价格下限 |
| `max_price` | `filters[$and][3][discountPrice][$lte]=<n>` | 价格上限 |
| `tags` | `filters[tags][documentId][$in]=<id1>&...` | 多选标签 |

**priceType 映射**：
- `free` → `filters[$and][n][isFree][$eq]=true`
- `paid` → `filters[$and][n][isPaid][$eq]=true`
- `featured` → `filters[$and][n][isFeatured][$eq]=true`

### 3.2 默认排序逻辑

综合推荐（`sort=default`）：
```
isFeatured DESC → sort ASC → publishDate ASC（最早发布兜底）→ createdAt ASC
```

### 3.3 URL query 参数示例

```
?view=grid&sort=default&category=all&priceType=free&difficulty=beginner,intermediate&lang=zh-CN&min_price=0&max_price=999&tags=python,english&q=python
```

### 3.4 localStorage 键设计

| 键 | 值 | 说明 |
|----|----|------|
| `course_view_mode` | `grid` \| `list` | 视图偏好 |
| `course_filter_state` | JSON 字符串 | 完整过滤状态（sort/category/priceType/difficulty/language/priceRange/tags） |

## 4. 组件设计

### 4.1 组件拆分

```
pages/index/
└── index.vue                    # 首页主页面（编排）

components/
├── course-card/
│   └── course-card.vue          # 课程卡片（支持 grid/list 两种 mode）
├── course-sort-bar/
│   └── course-sort-bar.vue      # 排序 + 视图切换条
├── course-filter-chips/
│   └── course-filter-chips.vue  # 常驻快捷过滤芯片条
├── course-filter-drawer/
│   └── course-filter-drawer.vue # 筛选弹层（底部弹出）
└── course-active-filters/
    └── course-active-filters.vue # 已选条件行 + 结果计数
```

### 4.2 CourseCard.vue

**职责**：单门课程的卡片渲染，支持 Grid/List 两种布局。

**Props**：
```typescript
interface CourseCardProps {
  course: Course
  mode: 'grid' | 'list'
}
```

**事件**：
- `@click` → 跳转课程详情

**布局差异**：
- `grid`：封面在上（aspect 4:3），标题 1 行，元信息 2 行紧凑
- `list`：封面在左（220rpx × 180rpx），信息在右展开，描述 2 行

### 4.3 CourseSortBar.vue

**职责**：排序选项 + 视图切换图标。

**Props**：
```typescript
interface SortBarProps {
  modelValue: string    // 当前排序 key
  viewMode: 'grid' | 'list'
  showRating?: boolean  // 是否显示评分排序（默认 false）
}
```

**事件**：
- `@update:modelValue` → 排序变更
- `@update:viewMode` → 视图切换

**排序选项**（`showRating=false` 时隐藏评分）：
```typescript
const sortOptions = [
  { key: 'default', label: '综合推荐' },
  { key: 'newest', label: '最新发布' },
  { key: 'hot', label: '最热' },
  { key: 'price_asc', label: '价格 ↑' },
  { key: 'price_desc', label: '价格 ↓' },
  { key: 'rating', label: '评分最高' }  // showRating 控制显示
]
```

### 4.4 CourseFilterChips.vue

**职责**：常驻快捷过滤芯片条（互斥单选）。

**Props**：
```typescript
interface FilterChipsProps {
  modelValue: string  // all | free | paid | featured
}
```

**事件**：
- `@update:modelValue` → 芯片切换
- `@open-drawer` → 打开筛选弹层

### 4.5 CourseFilterDrawer.vue

**职责**：底部弹层，承载多维过滤。

**Props**：
```typescript
interface FilterDrawerProps {
  visible: boolean
  modelValue: CourseFilterState
  tags: Tag[]  // 可选标签列表
}

interface CourseFilterState {
  difficulty: string[]      // ['beginner', 'intermediate', ...]
  language: string[]        // ['zh-CN', 'en-US', ...]
  priceRange: [number, number]  // [0, 999]
  tags: string[]            // tag documentId 数组
}
```

**事件**：
- `@update:visible` → 关闭弹层
- `@apply` → 应用筛选（携带完整 state）
- `@reset` → 重置所有筛选

**内部结构**：
- 难度区：4 个 checkbox（入门/进阶/高级/专家）
- 语言区：5 个 checkbox（简中/繁中/英语/日语/韩语）
- 价格区间：滑块组件（0 - 999）
- 标签区：横滚标签 checkbox
- 底部：重置（左） + 确定（右）

### 4.6 CourseActiveFilters.vue

**职责**：展示已选过滤条件 + 结果计数 + 空状态。

**Props**：
```typescript
interface ActiveFiltersProps {
  filters: CourseFilterState
  priceType: string
  category: string
  total: number
  hasResult: boolean
}
```

**事件**：
- `@remove` → 移除单个条件（payload: { type, value }）
- `@clear-all` → 清除全部

**布局**：
- 有结果：已选胶囊（每个带 ×） + 清除全部 + "共 N 门课程"
- 无结果：空状态插图 + "没有符合条件的课程" + "尝试减少筛选条件"

## 5. API 改造

### 5.1 getCourseList 参数扩展

```typescript
export interface CourseListParams {
  page?: number
  pageSize?: number
  category?: string
  q?: string
  status?: string
  // 新增
  sort?: 'default' | 'newest' | 'hot' | 'price_asc' | 'price_desc' | 'rating'
  priceType?: 'free' | 'paid' | 'featured'
  difficulty?: string[]
  language?: string[]
  minPrice?: number
  maxPrice?: number
  tags?: string[]
}
```

### 5.2 sort 映射逻辑

```typescript
const SORT_MAP: Record<string, string> = {
  default: 'isFeatured:desc,sort:asc,publishDate:asc,createdAt:asc',
  newest: 'publishDate:desc,createdAt:desc',
  hot: 'studentCount:desc',
  price_asc: 'discountPrice:asc,originalPrice:asc',
  price_desc: 'discountPrice:desc,originalPrice:desc',
  rating: 'rating:desc,ratingCount:desc'
}
```

### 5.3 filters 组装逻辑

将 priceType/difficulty/language/priceRange/tags 组装为 Strapi v5 `filters[$and][n][field][$in]=value` 格式。

## 6. 状态持久化

### 6.1 URL query 同步（H5）

```typescript
// 监听过滤/排序/视图变化 → 更新 URL query
watch([sort, priceType, filterState, viewMode], () => {
  // #ifdef H5
  const query = buildQuery({ sort, priceType, filterState, viewMode })
  history.replaceState(null, '', `?${query}`)
  // #endif
})
```

### 6.2 localStorage 持久化

```typescript
// 视图模式独立存储
watch(viewMode, (v) => uni.setStorageSync('course_view_mode', v))

// 完整过滤状态存储
watch(filterState, (s) => uni.setStorageSync('course_filter_state', JSON.stringify(s)), { deep: true })
```

### 6.3 状态恢复

页面 `onMounted` 时：
1. 优先读 URL query（H5）
2. 回退 localStorage
3. 默认值兜底

## 7. 错误处理与边界

| 场景 | 处理 |
|------|------|
| 过滤结果为空 | 显示空状态插图 + "尝试减少筛选条件"，保留已选条件可移除 |
| API 请求失败 | 复用现有错误处理（已捕获，fallback 假数据），不阻断页面 |
| 标签列表为空 | 筛选弹层标签区显示"暂无标签"，不阻断其他筛选 |
| 价格区间异常（min > max） | 前端自动交换 min/max |
| URL query 参数非法 | 忽略非法值，使用默认值 |

## 8. 性能考虑

- **防抖**：过滤/排序变更后 300ms 防抖再发请求，避免频繁调用
- **分页**：保持现有分页逻辑，过滤/排序变更时重置到第 1 页
- **组件懒加载**：FilterDrawer 按需渲染（`v-if="visible"`），未打开时不占资源
- **图片懒加载**：Grid 视图卡片增多，封面图使用 `lazy-load` 属性

## 9. 兼容性

- **保持现有逻辑**：分类标签、搜索栏、Header、公告、广告、积分展示逻辑不变
- **新增功能叠加**：在分类标签下方依次插入 FilterChips → SortBar → ActiveFilters → 课程列表
- **API 向后兼容**：`getCourseList` 新增参数全部可选，不传时行为与现有完全一致
- **小程序兼容**：URL query 仅 H5 生效，小程序依赖 localStorage

## 10. 测试要点

| 测试项 | 验证点 |
|--------|--------|
| 视图切换 | Grid ↔ List 切换正常，刷新后保持偏好 |
| 排序 | 5 种排序结果正确，默认排序遵循 isFeatured → sort → publishDate |
| 评分隐藏 | UI 不显示评分选项，但 API 参数 `sort=rating` 可用 |
| 快捷芯片 | 全部/免费/付费/精选互斥切换，结果实时刷新 |
| 筛选弹层 | 难度/语言/价格/标签多选组合查询正确 |
| 已选条件 | 胶囊展示正确，× 移除单项，清除全部可用 |
| 空状态 | 无结果时显示插图 + 引导文案 |
| URL 持久化（H5） | 刷新页面过滤状态保持，URL 可分享 |
| localStorage 持久化 | 小程序返回首页恢复过滤状态 |
| 性能 | 防抖生效，无频繁请求 |
| 兼容性 | 现有分类/搜索/登录/分享功能不受影响 |
