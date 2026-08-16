import {
  isCorrectAnswer,
  toggleSelection,
  computeEarnedPoints,
  canRetryAnswer,
  isQuizPracticeMode,
  canTakeFormalQuiz,
  sumEarnedPoints,
} from '../../utils/quiz-logic'

describe('quiz-logic', () => {
  describe('isCorrectAnswer', () => {
    it('handles array answer', () => {
      expect(isCorrectAnswer(['A', 'B'], 'A')).toBe(true)
      expect(isCorrectAnswer(['A', 'B'], 'C')).toBe(false)
    })
    it('handles single answer with type coercion', () => {
      expect(isCorrectAnswer('B', 'B')).toBe(true)
      expect(isCorrectAnswer(2, '2')).toBe(true)
      expect(isCorrectAnswer('B', 'A')).toBe(false)
    })
  })

  describe('toggleSelection', () => {
    it('replaces with [key] for single_choice', () => {
      expect(toggleSelection(['A'], 'B', 'single_choice')).toEqual(['B'])
    })
    it('replaces with [key] for true_false', () => {
      expect(toggleSelection(['A'], 'B', 'true_false')).toEqual(['B'])
    })
    it('adds key for multiple_choice', () => {
      expect(toggleSelection(['A'], 'B', 'multiple_choice')).toEqual(['A', 'B'])
    })
    it('removes key for multiple_choice when already present', () => {
      expect(toggleSelection(['A', 'B'], 'A', 'multiple_choice')).toEqual(['B'])
    })
  })

  describe('computeEarnedPoints', () => {
    const config = { enabled: true, pointsType: 'lesson_points', perQuestionPoints: 5 }
    it('quiz_points uses question.points', () => {
      const cfg = { enabled: true, pointsType: 'quiz_points', perQuestionPoints: 0 }
      expect(computeEarnedPoints(true, cfg, false, { points: 10 }, 0)).toBe(10)
    })
    it('lesson_points uses perQuestionPoints', () => {
      expect(computeEarnedPoints(true, config, false, {}, 5)).toBe(5)
    })
    it('returns 0 when disabled', () => {
      expect(computeEarnedPoints(true, { ...config, enabled: false }, false, {}, 5)).toBe(0)
    })
    it('returns 0 in practice mode', () => {
      expect(computeEarnedPoints(true, config, true, {}, 5)).toBe(0)
    })
    it('returns 0 when wrong', () => {
      expect(computeEarnedPoints(false, config, false, {}, 5)).toBe(0)
    })
  })

  describe('canRetryAnswer', () => {
    it('true when enabled and within limit', () => {
      expect(canRetryAnswer(true, 1, 2)).toBe(true)
      expect(canRetryAnswer(true, 2, 2)).toBe(true)
    })
    it('false when disabled or over limit', () => {
      expect(canRetryAnswer(false, 1, 2)).toBe(false)
      expect(canRetryAnswer(true, 3, 2)).toBe(false)
    })
  })

  describe('isQuizPracticeMode', () => {
    it('true when lesson already earned', () => {
      expect(isQuizPracticeMode(new Set(['l1']), 'l1')).toBe(true)
    })
    it('false when not earned', () => {
      expect(isQuizPracticeMode(new Set(['l1']), 'l2')).toBe(false)
    })
  })

  describe('canTakeFormalQuiz', () => {
    it('true in practice mode regardless of daily limit', () => {
      expect(canTakeFormalQuiz(true, 5, 3)).toBe(true)
    })
    it('true in formal mode under limit', () => {
      expect(canTakeFormalQuiz(false, 2, 3)).toBe(true)
    })
    it('false in formal mode at limit', () => {
      expect(canTakeFormalQuiz(false, 3, 3)).toBe(false)
    })
  })

  describe('sumEarnedPoints', () => {
    it('sums array', () => {
      expect(sumEarnedPoints([1, 2, 3])).toBe(6)
    })
    it('returns 0 for empty', () => {
      expect(sumEarnedPoints([])).toBe(0)
    })
  })
})