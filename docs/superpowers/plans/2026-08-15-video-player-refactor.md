# 音视频播放页纯函数拆分与回归防护 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `pages/video-player/video-player.vue`（1543 行）中的纯计算逻辑抽离为 4 个 `utils/` 模块并配单元测试，实现行为不变的拆分与回归保护。

**Architecture:** 按职责横向拆出 4 个纯函数模块（player-data / player-playback / quiz-logic / points-store），每个模块配一个 `tests/unit/` 测试文件。`video-player.vue` 保留所有状态（ref）与副作用（API 调用、`uni.*`、video context），仅改为调用这些纯函数。所有函数从现有代码原样提炼，不改变判定结果。

**Tech Stack:** Vue 3 + TypeScript + uni-app，测试用 Jest + ts-jest（`jest.unit.config.js`，`testEnvironment: node`）。

---

## 文件结构

```
utils/
├── player-data.ts        # 新建：数据归一化与富化
├── player-playback.ts    # 新建：播放决策与时间格式化
├── quiz-logic.ts         # 新建：答题判定与积分计算
└── points-store.ts       # 新建：领分渠道决策与标签
tests/unit/
├── player-data.test.ts   # 新建
├── player-playback.test.ts  # 新建
├── quiz-logic.test.ts    # 新建
└── points-store.test.ts  # 新建
pages/video-player/video-player.vue  # 修改：替换为模块函数调用，删除被替换的本地函数
```

> ⚠️ **HBuilder X 约束**：`d:\zhao\strapi-course` 为 HBuilder X 环境。本计划**只修改 TS 源码 + 运行 jest 单测**，**禁止执行任何构建/依赖安装命令**（`npm run build` / `pnpm install` / `npm install`）。修改源码后由用户在 HBuilder X 中手动编译。

---

## Task 1: `utils/player-data.ts` — 数据归一化与富化

**Files:**
- Create: `utils/player-data.ts`
- Test: `tests/unit/player-data.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/player-data.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --config jest.unit.config.js tests/unit/player-data.test.ts`
Expected: FAIL，报 `Cannot find module '../../utils/player-data'`

- [ ] **Step 3: 实现模块**

创建 `utils/player-data.ts`：

```ts
/** 把 API 返回的各种数据形态统一为数组（数组 / {data:[...]} / 单对象） */
export function normalizeList<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.data)) return data.data
  if (data && typeof data === 'object' && !Array.isArray(data.data)) return [data.data]
  return []
}

/** 以 lesson.documentId 构建进度对照 Map，防 number/string 类型不一致 */
export function buildProgressMap(progressData: any[]): Map<string, any> {
  const map = new Map<string, any>()
  for (const p of progressData) {
    const lessonDocId = p?.lesson?.documentId
    if (lessonDocId) map.set(lessonDocId, p)
  }
  return map
}

/** 富化课时，追加进度相关字段 */
export function enrichLessons<T extends { documentId: string }>(lessonData: T[], progressMap: Map<string, any>): (T & {
  completed: boolean
  progressPercent: number
  progressId?: number
  playPosition: number
  progressDuration: number
})[] {
  return lessonData.map((l) => {
    const p = progressMap.get(l.documentId)
    return {
      ...l,
      completed: p?.isCompleted || false,
      progressPercent: p?.progress || 0,
      progressId: p?.id || undefined,
      playPosition: p?.playPosition || 0,
      progressDuration: p?.duration || 0,
    }
  })
}

/** 第一个未完成课时下标，无则 -1 */
export function findFirstIncompleteIndex(lessons: Array<{ completed?: boolean }>): number {
  return lessons.findIndex((l) => !l.completed)
}

/** 从积分流水抽取已领课时 id（source 可能是 number/string，统一 String） */
export function extractEarnedLessonIds(records: any[]): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.source) set.add(String(r.source))
  }
  return set
}

/** 统计 createdAt 前缀等于 todayStr 的流水条数 */
export function countTodayQuizRecords(records: any[], todayStr: string): number {
  let count = 0
  for (const r of records) {
    if (r.createdAt && r.createdAt.slice(0, 10) === todayStr) count++
  }
  return count
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --config jest.unit.config.js tests/unit/player-data.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add utils/player-data.ts tests/unit/player-data.test.ts
git commit -m "feat(player): extract player-data pure functions with unit tests"
```

---

## Task 2: `utils/player-playback.ts` — 播放决策与时间格式化

**Files:**
- Create: `utils/player-playback.ts`
- Test: `tests/unit/player-playback.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/player-playback.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --config jest.unit.config.js tests/unit/player-playback.test.ts`
Expected: FAIL，报 `Cannot find module '../../utils/player-playback'`

- [ ] **Step 3: 实现模块**

创建 `utils/player-playback.ts`：

```ts
export type PlaybackAction =
  | { type: 'show_resume'; position: number }
  | { type: 'show_completed' }
  | { type: 'resume'; position: number }
  | { type: 'restart' }
  | { type: 'start' }

interface PlaybackLesson {
  documentId: string
  completed?: boolean
  playPosition?: number
}

/** 续播/完成/从头三态决策。严格复刻 video-player.vue offerLessonPlayback 的 if/else 顺序 */
export function decidePlaybackAction(
  lesson: PlaybackLesson,
  alreadyPrompted: Set<string>
): PlaybackAction {
  if (alreadyPrompted.has(lesson.documentId)) {
    if (lesson.completed) return { type: 'restart' }
    if (lesson.playPosition && lesson.playPosition > 0)
      return { type: 'resume', position: lesson.playPosition }
    return { type: 'start' }
  }
  if (lesson.completed) return { type: 'show_completed' }
  if (lesson.playPosition && lesson.playPosition > 0)
    return { type: 'show_resume', position: lesson.playPosition }
  return { type: 'start' }
}

/** MM:SS 时间格式化 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/** 时长格式化：X小时Y分钟Z秒 */
export function formatDuration(val: any): string {
  const totalSeconds = Number(val) || 0
  if (totalSeconds <= 0) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (mins > 0) parts.push(`${mins}分钟`)
  if (secs > 0) parts.push(`${secs}秒`)
  return parts.join('') || '0秒'
}

/** 播放进度百分比；duration <= 0 返回 null（不可算，由调用方决定是否更新，保持原值语义） */
export function computeProgress(currentTime: number, duration: number): number | null {
  if (duration <= 0) return null
  return (currentTime / duration) * 100
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --config jest.unit.config.js tests/unit/player-playback.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add utils/player-playback.ts tests/unit/player-playback.test.ts
git commit -m "feat(player): extract player-playback pure functions with unit tests"
```

---

## Task 3: `utils/quiz-logic.ts` — 答题判定与积分计算

**Files:**
- Create: `utils/quiz-logic.ts`
- Test: `tests/unit/quiz-logic.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/quiz-logic.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --config jest.unit.config.js tests/unit/quiz-logic.test.ts`
Expected: FAIL，报 `Cannot find module '../../utils/quiz-logic'`

- [ ] **Step 3: 实现模块**

创建 `utils/quiz-logic.ts`：

```ts
/** 判定答案是否正确：answer 可能是数组或单值，统一 String 比较 */
export function isCorrectAnswer(answer: any, key: string): boolean {
  const isArray = Array.isArray(answer)
  return isArray ? (answer as any[]).includes(key) : String(answer) === String(key)
}

/** 选项切换：单选/判断替换为 [key]，多选切换增删 */
export function toggleSelection(
  currentSelected: string[],
  key: string,
  questionType: string
): string[] {
  if (questionType === 'single_choice' || questionType === 'true_false') {
    return [key]
  }
  const index = currentSelected.indexOf(key)
  if (index > -1) {
    const next = [...currentSelected]
    next.splice(index, 1)
    return next
  }
  return [...currentSelected, key]
}

/** 得分计算：答对 && 积分开启 && 非练习模式才得分 */
export function computeEarnedPoints(
  isCorrect: boolean,
  pointsConfig: { enabled?: boolean; pointsType?: string; perQuestionPoints?: number },
  isPracticeMode: boolean,
  question: { points?: number },
  perQuestionPoints: number
): number {
  if (!isCorrect) return 0
  if (!pointsConfig.enabled || isPracticeMode) return 0
  if (pointsConfig.pointsType === 'quiz_points') {
    return question?.points || 0
  }
  return perQuestionPoints
}

/** 错题重试判定 */
export function canRetryAnswer(
  quizRetryEnabled: boolean,
  currentRetryCount: number,
  quizMaxRetryCount: number
): boolean {
  return quizRetryEnabled && currentRetryCount <= quizMaxRetryCount
}

/** 练习模式判定：已领分 → 练习模式 */
export function isQuizPracticeMode(earnedLessonIds: Set<string>, lessonDocumentId: string): boolean {
  return earnedLessonIds.has(lessonDocumentId)
}

/** 是否可进行正式答题：练习模式不限，正式答题受每日上限约束 */
export function canTakeFormalQuiz(
  isPracticeMode: boolean,
  todayQuizCount: number,
  maxDailyQuiz: number
): boolean {
  if (isPracticeMode) return true
  return todayQuizCount < maxDailyQuiz
}

/** 汇总本场得分 */
export function sumEarnedPoints(earnedPointsPerQuestion: number[]): number {
  return earnedPointsPerQuestion.reduce((sum, p) => sum + p, 0)
}
```

> **注意**：`canTakeFormalQuiz` 返回 `todayQuizCount < maxDailyQuiz`（即"未达上限可答题"）。原 `video-player.vue` 中 startQuiz 的拦截条件是 `!isPracticeMode && todayQuizCount >= maxDailyQuiz` 时 return（不可答）。抽成"是否可答"函数后，调用方逻辑取反即可，见 Task 5。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --config jest.unit.config.js tests/unit/quiz-logic.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add utils/quiz-logic.ts tests/unit/quiz-logic.test.ts
git commit -m "feat(player): extract quiz-logic pure functions with unit tests"
```

---

## Task 4: `utils/points-store.ts` — 领分渠道决策与标签

**Files:**
- Create: `utils/points-store.ts`
- Test: `tests/unit/points-store.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/points-store.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --config jest.unit.config.js tests/unit/points-store.test.ts`
Expected: FAIL，报 `Cannot find module '../../utils/points-store'`

- [ ] **Step 3: 实现模块**

创建 `utils/points-store.ts`：

```ts
/** 课时领分：specific + channel_cross_points=true + 多候选渠道 → 弹选择器 */
export function shouldShowChannelPicker(
  channelScope: string,
  channelIds: any[],
  channelCrossPointsFlag: boolean
): boolean {
  return channelCrossPointsFlag && channelScope === 'specific' && channelIds.length > 1
}

/** 答题领分：all 范围，或 specific 且一个渠道都没有 → 拉取可用渠道 */
export function shouldFetchAvailableChannels(
  channelConfig: { channelScope?: string; channelIds?: any[] },
  knownChannels: any[]
): boolean {
  if (channelConfig?.channelScope === 'all') return true
  if (channelConfig?.channelScope === 'specific' && knownChannels.length === 0) return true
  return false
}

/** specific 模式：id 数组 → 完整对象（name 兜底为 id） */
export function buildChannelOptions(channelIds: any[]): Array<{ documentId: any; name: any; id: any }> {
  return (channelIds || []).map((id: any) => ({ documentId: id, name: id, id }))
}

/** 按 documentId 去重保留完整对象 */
export function dedupeChannels(channels: any[]): any[] {
  return [...new Map(channels.map((c: any) => [c.documentId, c])).values()]
}

/** 渠道标签，默认渠道追加"（默认）" */
export function buildChannelLabels(channelIds: any[], defaultChannelId: any): string[] {
  return channelIds.map((id) => {
    const isDefault = isDefaultChannel(id, defaultChannelId)
    return `${id}${isDefault ? '（默认）' : ''}`
  })
}

/** String 比较判断是否默认渠道 */
export function isDefaultChannel(id: any, defaultChannelId: any): boolean {
  return String(id) === String(defaultChannelId)
}

/** 统一 String() 转换，消除 number/string 类型不一致 */
export function normalizeChannelId(id: any): string {
  return String(id)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --config jest.unit.config.js tests/unit/points-store.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add utils/points-store.ts tests/unit/points-store.test.ts
git commit -m "feat(player): extract points-store pure functions with unit tests"
```

---

## Task 5: `video-player.vue` 集成替换

**Files:**
- Modify: `pages/video-player/video-player.vue`

本任务将现有内联逻辑替换为模块函数调用，删除被替换的本地函数。**此任务不新增测试**（行为不变，由既有单测 + HBuilder X 编译验证）。

> ⚠️ HBuilder X 约束：本任务只改源码，不执行构建。完成后由用户在 HBuilder X 手动编译。

- [ ] **Step 1: 添加 import**

在 `pages/video-player/video-player.vue` 脚本区 import 块（约 206-215 行）追加：

```ts
import { normalizeList, buildProgressMap, enrichLessons, findFirstIncompleteIndex, extractEarnedLessonIds, countTodayQuizRecords } from '../../utils/player-data'
import { decidePlaybackAction, formatTime, formatDuration, computeProgress } from '../../utils/player-playback'
import { isCorrectAnswer, toggleSelection, computeEarnedPoints, canRetryAnswer, isQuizPracticeMode, canTakeFormalQuiz, sumEarnedPoints } from '../../utils/quiz-logic'
import { shouldShowChannelPicker, shouldFetchAvailableChannels, buildChannelOptions, dedupeChannels, buildChannelLabels, isDefaultChannel } from '../../utils/points-store'
```

- [ ] **Step 2: 替换 `loadData` 中的数据归一化逻辑**

将 340-356 行的 `lessonData`/`progressData` 归一化替换为：

```ts
const lessonData = normalizeList<any>(lessonsRes)
const progressData = normalizeList<any>(progressRes)
```

（原 341-345 行的数组/`{data}` 分支与 348-356 行的进度分支由 `normalizeList` 统一处理。）

- [ ] **Step 3: 替换进度 Map 构建与课时富化**

将 358-363 行 `buildProgressMap` 替换为：

```ts
const progressMap = buildProgressMap(progressData)
```

将 373-387 行的 `lessons.value = lessonData.map(...)` 替换为：

```ts
lessons.value = enrichLessons(lessonData, progressMap)
```

将 `currentLessonIndex.value` 的初始下标逻辑（390-392 行）替换为：

```ts
const firstIncompleteIndex = findFirstIncompleteIndex(lessons.value)
currentLessonIndex.value = firstIncompleteIndex >= 0 ? firstIncompleteIndex : lessonIndex
```

- [ ] **Step 4: 替换已领积分 id 抽取与今日次数统计**

将 `loadData` 中 417-425 行的 `lids`/`todayCount` 计算替换为：

```ts
const lids = extractEarnedLessonIds(records)
const todayCount = countTodayQuizRecords(records, new Date().toISOString().slice(0, 10))
```

- [ ] **Step 5: 替换 `offerLessonPlayback` 决策逻辑**

将 `offerLessonPlayback`（512-551 行）中的 if/else 决策替换为 `decidePlaybackAction`。保持副作用（设 ref、弹窗、`playLessonFrom`）不变：

```ts
function offerLessonPlayback(index: number) {
  const lesson = lessons.value[index]
  if (!lesson) return
  initialTime.value = 0
  currentTime.value = 0
  progress.value = 0
  resumePositionText.value = lesson.playPosition > 0 ? formatTime(Math.floor(lesson.playPosition)) : ''

  const action = decidePlaybackAction(lesson, resumeShownSet.value)

  switch (action.type) {
    case 'restart':
      playLessonFrom(0, true)
      break
    case 'resume':
      playLessonFrom(action.position, true)
      break
    case 'show_completed':
      resumeMode.value = 'completed'
      showResumeDialog.value = true
      resumeShownSet.value.add(lesson.documentId)
      break
    case 'show_resume':
      resumeMode.value = 'resume'
      showResumeDialog.value = true
      resumeShownSet.value.add(lesson.documentId)
      break
    case 'start':
      currentTime.value = 0
      progress.value = 0
      initialTime.value = 0
      break
  }
}
```

> **行为等价性核对**：原逻辑——已提示过且已完成为 restart；已提示过且有进度为 resume；否则已完成弹 completed、有进度弹 resume、无进度 start。`decidePlaybackAction` 严格复刻此顺序，switch 副作用与原分支一致。

- [ ] **Step 6: 替换 `onTimeUpdate` 进度计算**

将 602-610 行替换为：

```ts
function onTimeUpdate(e: any) {
  const curTime = Math.floor(e.detail.currentTime || 0)
  const dur = Math.floor(e.detail.duration || 0)
  currentTime.value = curTime
  const pct = computeProgress(curTime, dur)
  if (dur > 0) {
    duration.value = dur
    if (pct !== null) progress.value = pct
  }
  if (progress.value >= 98 && !hasMarkedComplete) {
    markLessonComplete()
  }
}
```

> **行为等价**：原代码 `if (dur > 0) { duration=dur; progress=(cur/dur)*100 }`。`computeProgress` 在 `dur<=0` 返回 null，调用方不更新 progress，与原行为（不更新保持原值）一致。

- [ ] **Step 7: 替换 `startQuiz` 中的判定**

将 814-825 行的练习模式判定与每日上限判定替换为：

```ts
isPracticeMode.value = false
const lid = currentLesson.value?.documentId
if (lid && earnedLessonIds.value.has(lid)) {
  isPracticeMode.value = true
}

if (!canTakeFormalQuiz(isPracticeMode.value, todayQuizCount.value, maxDailyQuiz.value)) {
  uni.showToast({ title: `今日答题次数已达上限(${maxDailyQuiz.value}次)`, icon: 'none' })
  return
}
```

> 原拦截条件 `!isPracticeMode && todayQuizCount >= maxDailyQuiz` 等价于 `!canTakeFormalQuiz(...)`（`canTakeFormalQuiz = isPracticeMode || todayCount < maxDaily`，取反即 `!isPracticeMode && todayCount >= maxDaily`）。练习模式判定也可改用 `isQuizPracticeMode(earnedLessonIds, lid)`：

```ts
isPracticeMode.value = lid ? isQuizPracticeMode(earnedLessonIds.value, lid) : false
```

- [ ] **Step 8: 替换 `isCorrectAnswer` / `selectOption` / `submitAnswer` / 重试判定**

删除本地 `isCorrectAnswer`（854-858），模板与脚本统一用 `utils/quiz-logic` 导出的 `isCorrectAnswer`（签名一致，模板 83、88、89 行无需改动）。

将 `selectOption`（860-874）替换为：

```ts
function selectOption(key: string) {
  if (showResult.value) return
  selectedAnswers.value = toggleSelection(selectedAnswers.value, key, currentQuestion.value?.type)
}
```

将 `submitAnswer` 中的得分计算（890-900）替换为：

```ts
if (isCorrect.value) {
  quizSuccessCount.value++
  const earned = computeEarnedPoints(
    isCorrect.value,
    pointsConfig.value,
    isPracticeMode.value,
    currentQuestion.value,
    pointsConfig.value.perQuestionPoints
  )
  earnedPointsPerQuestion.value.push(earned)
} else {
  currentRetryCount.value++
  const canRetry = canRetryAnswer(quizRetryEnabled.value, currentRetryCount.value, quizMaxRetryCount.value)
  if (!canRetry) {
    earnedPointsPerQuestion.value.push(0)
  }
}
```

- [ ] **Step 9: 替换 `completeQuiz` 汇总**

将 929 行 `completeQuiz` 中的 `totalEarned` 替换为：

```ts
const totalEarned = sumEarnedPoints(earnedPointsPerQuestion.value)
```

- [ ] **Step 10: 替换 `tryClaimLessonPoints` 渠道判定与标签**

将 708-738 行替换为：

```ts
async function tryClaimLessonPoints(lesson: any) {
  if (earnedLessonIds.value.has(lesson.documentId)) return

  const ch = (courseDetail.value as any) || {}
  const channelIds: any[] = Array.isArray(ch.channelIds) ? ch.channelIds : []
  const pointChannelId = ch.pointChannel?.id ?? ch.pointChannel ?? null

  const needPicker = shouldShowChannelPicker(ch.channelScope, channelIds, featureFlagChannelCrossPoints.value)

  const doClaim = async (selectedChannelId?: number | string) => {
    try {
      const res = await claimLessonPoints(lesson.progressId, { selectedChannelId })
      const earned = (res as any)?.pointsEarned || 0
      pointsBalance.value += earned
      earnedLessonIds.value = new Set([...earnedLessonIds.value, lesson.documentId])
      uni.showToast({ title: `获得${earned}积分！`, icon: 'success' })
    } catch (e: any) {
      const errMsg = (e as any)?.error || '积分领取失败'
      uni.showToast({ title: errMsg, icon: 'none' })
    }
  }

  if (needPicker) {
    const labels = buildChannelLabels(channelIds, pointChannelId)
    uni.showActionSheet({
      itemList: labels,
      success: (res) => doClaim(channelIds[res.tapIndex]),
      fail: () => doClaim(pointChannelId || undefined)
    })
    return
  }

  doClaim()
}
```

- [ ] **Step 11: 替换 `doClaimFlow` 渠道拉取与判定**

将 958-997 行替换为：

```ts
async function doClaimFlow(totalEarned: number) {
  let availableChannels: any[] = []

  if (channelConfig.value && Array.isArray(channelConfig.value.channelIds)) {
    availableChannels = buildChannelOptions(channelConfig.value.channelIds)
  }

  if (shouldFetchAvailableChannels(channelConfig.value, availableChannels)) {
    try {
      const channelRes = await request('/zhao-common/v1/channels/available', { method: 'GET' })
      const channels = (channelRes as any)?.data || []
      availableChannels = dedupeChannels(channels)
    } catch (e) {
      console.warn('[获取可用渠道失败]', e)
    }
  }

  const needPicker = availableChannels.length > 1

  if (needPicker) {
    channelPickerList.value = availableChannels
    pendingClaimTotal.value = totalEarned
    showChannelPicker.value = true
  } else if (availableChannels.length === 1) {
    await claimWithChannel(availableChannels[0].documentId, totalEarned)
  } else {
    uni.showToast({ title: '无可选渠道', icon: 'none' })
  }
}
```

- [ ] **Step 12: 删除被替换的本地函数**

删除以下已不再使用的本地函数定义（避免重复声明）：
- `formatTime`（740-744）
- `formatDuration`（746-757）
- 本地 `isCorrectAnswer`（854-858）

> 保留 `formatTime`/`formatDuration` 的**调用点**（模板 53 行仍用），改为指向 import 的模块函数，无需改动模板。

- [ ] **Step 13: 运行全部单测确认无回归**

Run: `npx jest --config jest.unit.config.js`
Expected: PASS（4 个新测试文件 + 既有 2 个测试文件全部通过）

- [ ] **Step 14: 人工核对未使用 import**

检查 `video-player.vue` 中 import 的每个函数是否都被使用，删除未使用的 import（如 `isDefaultChannel`/`normalizeChannelId` 若未使用则从 import 移除）。用编辑器搜索确认无 `is defined but never used` 告警。

- [ ] **Step 15: 提交**

```bash
git add pages/video-player/video-player.vue
git commit -m "refactor(player): use extracted pure functions in video-player"
```

---

## 自审

**Spec coverage 核对**：
- 模块 1 player-data（spec §3）→ Task 1 ✅
- 模块 2 player-playback（spec §4）→ Task 2 ✅
- 模块 3 quiz-logic（spec §5）→ Task 3 ✅
- 模块 4 points-store（spec §6）→ Task 4 ✅
- `video-player.vue` 集成（spec §7）→ Task 5 ✅
- 单测设计（spec §8）→ Task 1-4 测试文件 ✅
- 验收标准（spec §9）→ Task 5 Step 13（全量单测）+ HBuilder X 编译 ✅
- spec 修正点：`computeProgress` 返回 `number|null`（Task 2）✅；`points-store` 措辞（Task 4）✅

**Placeholder 扫描**：无 TBD/TODO/空步骤；每个代码步骤含完整代码与命令。

**Type 一致性**：
- `computeProgress` 在 Task 2 定义为 `(number,number)=>number|null`，Task 5 Step 6 用 `pct !== null` 判断，一致 ✅
- `canTakeFormalQuiz` 在 Task 3 定义为"是否可答"，Task 5 Step 7 用 `!canTakeFormalQuiz(...)` 拦截，一致 ✅
- `decidePlaybackAction` 的 `PlaybackAction` 类型在 Task 2 定义，Task 5 Step 5 switch 各 case 与类型分支一一对应 ✅
- `isCorrectAnswer`/`toggleSelection`/`computeEarnedPoints`/`canRetryAnswer`/`sumEarnedPoints` 签名在 Task 3 定义，Task 5 Step 8-9 调用一致 ✅
- `shouldShowChannelPicker`/`shouldFetchAvailableChannels`/`buildChannelOptions`/`dedupeChannels`/`buildChannelLabels` 在 Task 4 定义，Task 5 Step 10-11 调用一致 ✅

**遗留澄清**：Task 5 Step 14 需确认 `isDefaultChannel`/`normalizeChannelId` 是否被页面使用——计划中 `tryClaimLessonPoints` 用 `buildChannelLabels`（内部调用 `isDefaultChannel`），页面不直接调用这两个函数，故第 14 步要求从 import 剔除未直接使用的函数，避免 lint 告警。

---

## Execution Handoff

计划已完成并保存到 `docs/superpowers/plans/2026-08-15-video-player-refactor.md`。两种执行方式：

**1. Subagent-Driven（推荐）** — 每个任务派发独立 subagent，任务间审查，快速迭代

**2. Inline Execution** — 在当前会话用 executing-plans 批量执行并设置检查点

你选择哪种方式？