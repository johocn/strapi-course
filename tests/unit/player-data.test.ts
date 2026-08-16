import {
  normalizeList,
  buildProgressMap,
  enrichLessons,
  findFirstIncompleteIndex,
  extractEarnedLessonIds,
  countTodayQuizRecords,
} from '../../utils/player-data'

describe('player-data', () => {
  describe('normalizeList', () => {
    it('returns array as-is', () => {
      expect(normalizeList([1, 2])).toEqual([1, 2])
    })
    it('unwraps { data: [...] }', () => {
      expect(normalizeList({ data: [1, 2] })).toEqual([1, 2])
    })
    it('wraps { data: obj } into array', () => {
      expect(normalizeList({ data: { id: 1 } })).toEqual([{ id: 1 }])
    })
    it('returns [] for empty/null', () => {
      expect(normalizeList(null)).toEqual([])
      expect(normalizeList(undefined)).toEqual([])
      expect(normalizeList({})).toEqual([])
    })
  })

  describe('buildProgressMap', () => {
    it('maps by lesson.documentId', () => {
      const map = buildProgressMap([
        { lesson: { documentId: 'l1' }, progress: 50 },
        { lesson: { documentId: 'l2' }, progress: 100 },
      ])
      expect(map.get('l1')?.progress).toBe(50)
      expect(map.get('l2')?.progress).toBe(100)
    })
    it('skips entries without lesson.documentId', () => {
      const map = buildProgressMap([{ progress: 50 }])
      expect(map.size).toBe(0)
    })
  })

  describe('enrichLessons', () => {
    const map = new Map<string, any>([
      ['l1', { isCompleted: true, progress: 80, id: 7, playPosition: 120, duration: 300 }],
    ])
    it('adds completed/progressPercent/progressId/playPosition/progressDuration', () => {
      const result = enrichLessons([{ documentId: 'l1' }], map)
      expect(result[0]).toMatchObject({
        completed: true,
        progressPercent: 80,
        progressId: 7,
        playPosition: 120,
        progressDuration: 300,
      })
    })
    it('defaults when no matching progress', () => {
      const result = enrichLessons([{ documentId: 'lX' }], map)
      expect(result[0]).toMatchObject({
        completed: false,
        progressPercent: 0,
        progressId: undefined,
        playPosition: 0,
        progressDuration: 0,
      })
    })
    it('preserves original lesson fields', () => {
      const result = enrichLessons([{ documentId: 'l1', title: 'A' }], map)
      expect(result[0].title).toBe('A')
    })
  })

  describe('findFirstIncompleteIndex', () => {
    it('returns first index with completed=false', () => {
      const lessons = [
        { completed: true },
        { completed: false },
        { completed: false },
      ] as any[]
      expect(findFirstIncompleteIndex(lessons)).toBe(1)
    })
    it('returns -1 when all completed', () => {
      const lessons = [{ completed: true }] as any[]
      expect(findFirstIncompleteIndex(lessons)).toBe(-1)
    })
    it('returns -1 for empty array', () => {
      expect(findFirstIncompleteIndex([])).toBe(-1)
    })
  })

  describe('extractEarnedLessonIds', () => {
    it('collects source as string', () => {
      const set = extractEarnedLessonIds([
        { source: 'l1' },
        { source: 22 },
        { source: 'l1' },
      ])
      expect(set.has('l1')).toBe(true)
      expect(set.size).toBe(2)
    })
    it('ignores records without source', () => {
      const set = extractEarnedLessonIds([{ source: undefined }])
      expect(set.size).toBe(0)
    })
  })

  describe('countTodayQuizRecords', () => {
    it('counts records whose createdAt matches today string', () => {
      const today = '2026-08-15'
      const records = [
        { createdAt: '2026-08-15T10:00:00Z' },
        { createdAt: '2026-08-15T11:00:00Z' },
        { createdAt: '2026-08-14T10:00:00Z' },
        { createdAt: undefined },
      ]
      expect(countTodayQuizRecords(records, today)).toBe(2)
    })
  })
})