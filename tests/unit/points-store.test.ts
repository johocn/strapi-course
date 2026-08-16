import {
  shouldShowChannelPicker,
  shouldFetchAvailableChannels,
  buildChannelOptions,
  dedupeChannels,
  buildChannelLabels,
  isDefaultChannel,
  normalizeChannelId,
} from '../../utils/points-store'

describe('points-store', () => {
  describe('shouldShowChannelPicker', () => {
    it('true when specific + flag + multiple channels', () => {
      expect(shouldShowChannelPicker('specific', [1, 2], true)).toBe(true)
    })
    it('false when flag off', () => {
      expect(shouldShowChannelPicker('specific', [1, 2], false)).toBe(false)
    })
    it('false when not specific', () => {
      expect(shouldShowChannelPicker('all', [1, 2], true)).toBe(false)
    })
    it('false when one channel', () => {
      expect(shouldShowChannelPicker('specific', [1], true)).toBe(false)
    })
  })

  describe('shouldFetchAvailableChannels', () => {
    it('true for all scope', () => {
      expect(shouldFetchAvailableChannels({ channelScope: 'all' }, [])).toBe(true)
    })
    it('true for specific with no known channels', () => {
      expect(shouldFetchAvailableChannels({ channelScope: 'specific', channelIds: [] }, [])).toBe(true)
    })
    it('false for specific with known channels', () => {
      expect(shouldFetchAvailableChannels({ channelScope: 'specific', channelIds: [1] }, [{ documentId: '1' }])).toBe(false)
    })
  })

  describe('buildChannelOptions', () => {
    it('maps ids to objects with name fallback to id', () => {
      expect(buildChannelOptions([1, 2])).toEqual([
        { documentId: 1, name: 1, id: 1 },
        { documentId: 2, name: 2, id: 2 },
      ])
    })
  })

  describe('dedupeChannels', () => {
    it('dedupes by documentId keeping full object', () => {
      const result = dedupeChannels([
        { documentId: 'a', name: 'A' },
        { documentId: 'a', name: 'A2' },
        { documentId: 'b', name: 'B' },
      ])
      expect(result).toHaveLength(2)
    })
  })

  describe('buildChannelLabels', () => {
    it('appends （默认） to default channel', () => {
      expect(buildChannelLabels([1, 2], 1)).toEqual(['1（默认）', '2'])
    })
    it('no marker when no default', () => {
      expect(buildChannelLabels([1, 2], 99)).toEqual(['1', '2'])
    })
  })

  describe('isDefaultChannel / normalizeChannelId', () => {
    it('compares with String coercion', () => {
      expect(isDefaultChannel(1, 1)).toBe(true)
      expect(isDefaultChannel('1', 1)).toBe(true)
      expect(isDefaultChannel(2, 1)).toBe(false)
    })
    it('normalizes to string', () => {
      expect(normalizeChannelId(1)).toBe('1')
      expect(normalizeChannelId('x')).toBe('x')
    })
  })
})