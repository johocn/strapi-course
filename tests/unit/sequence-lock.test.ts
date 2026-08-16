import {
  checkItemLock,
  isCourseCompleted,
  isQuizButtonLocked,
  RETRY_MAP
} from '../../utils/sequence-lock'
import type { LockableItem } from '../../utils/sequence-lock'

describe('sequence-lock', () => {
  describe('RETRY_MAP', () => {
    it('maps all enum values correctly', () => {
      expect(RETRY_MAP.no_retry).toBe(0)
      expect(RETRY_MAP.retry_1).toBe(1)
      expect(RETRY_MAP.retry_2).toBe(2)
      expect(RETRY_MAP.retry_3).toBe(3)
      expect(RETRY_MAP.retry_4).toBe(4)
    })
  })

  describe('checkItemLock', () => {
    const tag1 = { documentId: 'tag-1', name: '入门系列' }
    const tag2 = { documentId: 'tag-2', name: '进阶系列' }

    const items: LockableItem[] = [
      { documentId: 'l1', title: '课程1', sequenceNumber: 1, sequenceTag: tag1, enforceSequence: true, isCompleted: true },
      { documentId: 'l2', title: '课程2', sequenceNumber: 2, sequenceTag: tag1, enforceSequence: true, isCompleted: false },
      { documentId: 'l3', title: '课程3', sequenceNumber: 3, sequenceTag: tag1, enforceSequence: true, isCompleted: false },
      { documentId: 'l4', title: '自由课程', sequenceNumber: 0, sequenceTag: null, enforceSequence: false, isCompleted: false },
    ]

    it('returns unlocked for items without sequenceTag', () => {
      const result = checkItemLock(items[3], items)
      expect(result.locked).toBe(false)
    })

    it('returns unlocked for items with sequenceNumber=0', () => {
      const noSeq: LockableItem = { ...items[0], sequenceNumber: 0 }
      const result = checkItemLock(noSeq, items)
      expect(result.locked).toBe(false)
    })

    it('returns unlocked when all prerequisites completed', () => {
      const allCompleted: LockableItem[] = [
        { documentId: 'l1', title: '课程1', sequenceNumber: 1, sequenceTag: tag1, enforceSequence: true, isCompleted: true },
        { documentId: 'l2', title: '课程2', sequenceNumber: 2, sequenceTag: tag1, enforceSequence: true, isCompleted: true },
      ]
      const result = checkItemLock(allCompleted[1], allCompleted)
      expect(result.locked).toBe(false)
    })

    it('returns unlocked when prerequisite completed (chain step 2)', () => {
      // 课程2 的前置是课程1（已 completed=true）→ 不锁定
      const result = checkItemLock(items[1], items)
      expect(result.locked).toBe(false)
    })

    it('returns locked when prerequisite not completed (chain)', () => {
      // 课程3 的前置包含课程2（未完成）→ 锁定，且第一个未完成是课程2
      const result = checkItemLock(items[2], items)
      expect(result.locked).toBe(true)
      expect(result.enforceMode).toBe(true)
      expect(result.reason).toContain('课程2')
      expect(result.firstIncomplete?.documentId).toBe('l2')
    })

    it('returns soft lock when enforceSequence is false', () => {
      const softItems: LockableItem[] = [
        { documentId: 'l1', title: '课程1', sequenceNumber: 1, sequenceTag: tag1, enforceSequence: false, isCompleted: false },
        { documentId: 'l2', title: '课程2', sequenceNumber: 2, sequenceTag: tag1, enforceSequence: false, isCompleted: false },
      ]
      const result = checkItemLock(softItems[1], softItems)
      expect(result.locked).toBe(true)
      expect(result.enforceMode).toBe(false)
    })

    it('isolates different sequenceTag groups', () => {
      const mixedItems: LockableItem[] = [
        { documentId: 'a1', title: 'A1', sequenceNumber: 1, sequenceTag: tag1, enforceSequence: true, isCompleted: false },
        { documentId: 'b1', title: 'B1', sequenceNumber: 1, sequenceTag: tag2, enforceSequence: true, isCompleted: false },
        { documentId: 'b2', title: 'B2', sequenceNumber: 2, sequenceTag: tag2, enforceSequence: true, isCompleted: false },
      ]
      // B2 的前置是 B1（同 tag2），A1 不影响
      const result = checkItemLock(mixedItems[2], mixedItems)
      expect(result.locked).toBe(true)
      expect(result.firstIncomplete?.documentId).toBe('b1')
    })
  })

  describe('isCourseCompleted', () => {
    it('returns true when all required lessons completed', () => {
      const lessons = [
        { isCompleted: true, isRequired: true },
        { isCompleted: true, isRequired: true },
      ]
      expect(isCourseCompleted(lessons)).toBe(true)
    })

    it('returns false when any required lesson not completed', () => {
      const lessons = [
        { isCompleted: true, isRequired: true },
        { isCompleted: false, isRequired: true },
      ]
      expect(isCourseCompleted(lessons)).toBe(false)
    })

    it('ignores optional lessons', () => {
      const lessons = [
        { isCompleted: true, isRequired: true },
        { isCompleted: false, isRequired: false },
      ]
      expect(isCourseCompleted(lessons)).toBe(true)
    })

    it('returns true when no required lessons', () => {
      const lessons: Array<{ isCompleted: boolean; isRequired: boolean }> = []
      expect(isCourseCompleted(lessons)).toBe(true)
    })
  })

  describe('isQuizButtonLocked', () => {
    const earnedIds = new Set<string>(['lesson-1'])

    it('returns false when allowRetakeQuiz is true', () => {
      expect(isQuizButtonLocked(true, true, earnedIds, 'lesson-1')).toBe(false)
    })

    it('returns true when isPointsClaimed is true', () => {
      expect(isQuizButtonLocked(false, true, earnedIds, 'lesson-2')).toBe(true)
    })

    it('returns true when lesson is in earnedLessonIds', () => {
      expect(isQuizButtonLocked(false, false, earnedIds, 'lesson-1')).toBe(true)
    })

    it('returns false when not claimed and not in earnedLessonIds', () => {
      expect(isQuizButtonLocked(false, false, earnedIds, 'lesson-2')).toBe(false)
    })
  })
})
