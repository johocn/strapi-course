import {
  decidePlaybackAction,
  formatTime,
  formatDuration,
  computeProgress,
  type PlaybackAction,
} from '../../utils/player-playback'

describe('player-playback', () => {
  describe('decidePlaybackAction', () => {
    const base = { documentId: 'l1', completed: false, playPosition: 0 }

    it('show_completed when completed and not prompted', () => {
      const a = decidePlaybackAction({ ...base, completed: true }, new Set())
      expect(a.type).toBe('show_completed')
    })

    it('show_resume when has position and not prompted', () => {
      const a = decidePlaybackAction({ ...base, playPosition: 120 }, new Set())
      expect(a.type).toBe('show_resume')
      expect((a as any).position).toBe(120)
    })

    it('start when no progress and not prompted', () => {
      const a = decidePlaybackAction(base, new Set())
      expect(a.type).toBe('start')
    })

    it('restart when prompted and completed', () => {
      const a = decidePlaybackAction({ ...base, completed: true }, new Set(['l1']))
      expect(a.type).toBe('restart')
    })

    it('resume when prompted and has position', () => {
      const a = decidePlaybackAction({ ...base, playPosition: 120 }, new Set(['l1']))
      expect(a.type).toBe('resume')
      expect((a as any).position).toBe(120)
    })

    it('start when prompted, no progress, not completed', () => {
      const a = decidePlaybackAction(base, new Set(['l1']))
      expect(a.type).toBe('start')
    })
  })

  describe('formatTime', () => {
    it('formats MM:SS', () => {
      expect(formatTime(185)).toBe('03:05')
      expect(formatTime(0)).toBe('00:00')
    })
  })

  describe('formatDuration', () => {
    it('formats hours/minutes/seconds', () => {
      expect(formatDuration(3661)).toBe('1小时1分钟1秒')
    })
    it('returns empty for <=0', () => {
      expect(formatDuration(0)).toBe('')
      expect(formatDuration('abc')).toBe('')
    })
  })

  describe('computeProgress', () => {
    it('returns percentage when duration > 0', () => {
      expect(computeProgress(50, 100)).toBe(50)
    })
    it('returns null when duration <= 0', () => {
      expect(computeProgress(50, 0)).toBeNull()
      expect(computeProgress(50, -1)).toBeNull()
    })
  })
})