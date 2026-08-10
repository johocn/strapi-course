import {
  buildCourseQuery,
  buildUrlQuery,
  parseUrlQuery,
  SORT_MAP,
  DEFAULT_FILTER_STATE,
  getSortOptions
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
