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
