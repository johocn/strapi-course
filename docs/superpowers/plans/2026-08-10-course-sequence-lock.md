# 课程播放顺序锁定与答题按钮锁定 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为课程播放增加顺序锁定（课程+课时级）、答题按钮锁定（领分后锁定）、错题复答字段下沉（全局 flag → 课程级枚举）。

**Architecture:** 自下而上分层实现——先后端 schema 加字段，再前端工具函数+弹窗组件，最后各页面集成。顺序锁定采用前端判定（方案A），复用现有 `lesson-progress`/`course-progress` 数据。

**Tech Stack:** Strapi v5（后端 schema）+ Vue 3 Composition API + UniApp（前端）+ TypeScript。

**Spec:** `docs/superpowers/specs/2026-08-10-course-sequence-lock-design.md`

---

## 文件结构

```
strapi/
└── plugins/zhao-course/server/src/content-types/
    ├── course/schema.json                    # 修改：新增5字段
    └── course-lesson/schema.json             # 修改：新增2字段

strapi-course/
├── utils/
│   └── sequence-lock.ts                     # 新建：顺序锁定判定工具
├── components/
│   └── sequence-lock-dialog/
│       └── sequence-lock-dialog.vue         # 新建：锁定弹窗（硬锁/软锁）
├── services/
│   └── api.ts                               # 修改：Course/Lesson 类型新增字段
├── pages/
│   ├── index/index.vue                      # 修改：课程级锁定拦截
│   ├── course-detail/course-detail.vue      # 修改：课时锁定 + 锁图标显示
│   └── video-player/video-player.vue        # 修改：课时切换锁定 + 答题按钮锁定 + quizRetryCount替换
└── tests/unit/
    └── sequence-lock.test.ts                # 新建：锁定判定单元测试
```

**关键发现（卡点修复）：**
- `course-progress` 表已有 `isCompleted` 字段 → 首页跨课程锁定直接用 `getMyCourseProgresses()` 获取，无需自己计算
- `quizRetryEnabled`/`quizMaxRetryCount` 集中在 `video-player.vue` 13 处引用，`quiz.vue` 不涉及
- `Lesson` 类型定义不完整（只有5字段），实际代码用 `as any` 绕过，新增字段保持同样模式
- 答题按钮 UI 在 `video-player.vue:157-159`
- `selectLesson` 在 `video-player.vue:557`，`goToNext` 在 `:876`

---

## Task 1: 后端 schema — course 新增 5 字段

**Files:**
- Modify: `d:\zhao\strapi\plugins\zhao-course\server\src\content-types\course\schema.json`

- [ ] **Step 1: 读取当前 course/schema.json**

用 Read 工具读取 `d:\zhao\strapi\plugins\zhao-course\server\src\content-types\course\schema.json`，找到 `attributes` 对象的最后一个字段（`deletedAt`）。

- [ ] **Step 2: 在 attributes 中新增 5 个字段**

用 Edit 工具，将 `deletedAt` 字段之前（或在 `attributes` 对象的闭合 `}` 之前）新增以下字段：

```json
    "enforceSequence": {
      "type": "boolean",
      "default": false
    },
    "sequenceTag": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::zhao-tag.tag",
      "inversedBy": "sequenceCourses"
    },
    "allowRetakeQuiz": {
      "type": "boolean",
      "default": false
    },
    "quizRetryCount": {
      "type": "enumeration",
      "enum": ["no_retry", "retry_1", "retry_2", "retry_3", "retry_4"],
      "default": "no_retry",
      "required": true
    },
```

注意：
- `sequenceNumber` 字段已存在于 course schema（用于排序），不需要新增
- `sequenceTag` 是 M2O 关系指向 `plugin::zhao-tag.tag`，`inversedBy` 为 `sequenceCourses`（需要在 zhao-tag 的 schema 中反向定义，但 Strapi 允许单向关系，如果反向不存在不影响功能）
- 如果 `deletedAt` 是最后一个字段，需要在它后面加逗号，或在它前面插入新字段

- [ ] **Step 3: 验证 JSON 合法**

Run: `cd d:\zhao\strapi && node -e "require('./plugins/zhao-course/server/src/content-types/course/schema.json')"`
Expected: 无报错（JSON 合法）

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi
git add plugins/zhao-course/server/src/content-types/course/schema.json
git commit -m "feat(course): add sequence lock and quiz retry fields to course schema"
```

---

## Task 2: 后端 schema — course-lesson 新增 2 字段

**Files:**
- Modify: `d:\zhao\strapi\plugins\zhao-course\server\src\content-types\course-lesson\schema.json`

- [ ] **Step 1: 读取当前 course-lesson/schema.json**

用 Read 工具读取 `d:\zhao\strapi\plugins\zhao-course\server\src\content-types\course-lesson\schema.json`，找到 `attributes` 对象的最后一个字段。

- [ ] **Step 2: 在 attributes 中新增 2 个字段**

用 Edit 工具，在 `deletedAt` 字段之前新增：

```json
    "enforceSequence": {
      "type": "boolean",
      "default": false
    },
    "sequenceTag": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::zhao-tag.tag",
      "inversedBy": "sequenceLessons"
    },
```

注意：
- `sequenceNumber` 字段已存在于 course-lesson schema，不需要新增
- `sequenceTag` 的 `inversedBy` 为 `sequenceLessons`（与 course 的 `sequenceCourses` 不同，避免冲突）

- [ ] **Step 3: 验证 JSON 合法**

Run: `cd d:\zhao\strapi && node -e "require('./plugins/zhao-course/server/src/content-types/course-lesson/schema.json')"`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi
git add plugins/zhao-course/server/src/content-types/course-lesson/schema.json
git commit -m "feat(course): add sequence lock fields to course-lesson schema"
```

---

## Task 3: 前端类型定义 — api.ts 更新 Course/Lesson 类型

**Files:**
- Modify: `d:\zhao\strapi-course\services\api.ts:608-637`

- [ ] **Step 1: 更新 Course 接口**

用 Edit 工具，将 `d:\zhao\strapi-course\services\api.ts` 中第 608-629 行的 `Course` 接口替换为：

```typescript
export interface Course {
  documentId: string
  title: string
  description?: string
  coverUrl?: string
  cover?: any
  category?: { name: string } | null
  tags?: Array<{ name: string }>
  createdAt?: string
  status?: string
  isPaid?: boolean
  isFree?: boolean
  enablePoints?: boolean
  points?: number
  difficulty?: string
  level?: string
  duration?: string
  author?: string
  studentCount?: number
  viewCount?: number
  rating?: number
  // 顺序锁定字段
  enforceSequence?: boolean
  sequenceNumber?: number
  sequenceTag?: { documentId: string; name: string } | null
  // 答题锁定字段
  allowRetakeQuiz?: boolean
  quizRetryCount?: 'no_retry' | 'retry_1' | 'retry_2' | 'retry_3' | 'retry_4'
}
```

- [ ] **Step 2: 更新 Lesson 接口**

将第 631-637 行的 `Lesson` 接口替换为：

```typescript
export interface Lesson {
  documentId: string
  title: string
  duration: number
  completed?: boolean
  progress?: number
  // 顺序锁定字段
  enforceSequence?: boolean
  sequenceNumber?: number
  sequenceTag?: { documentId: string; name: string } | null
  isRequired?: boolean
  // 已有但未定义的字段（补全）
  video_url?: string
  audio_url?: string
  pointsType?: string
  enablePoints?: boolean
  progressId?: string
  progressPercent?: number
  progressDuration?: number
  playPosition?: number
}
```

- [ ] **Step 3: 验证编译通过**

Run: `cd d:\zhao\strapi-course && npx tsc --noEmit 2>&1 | findstr "api.ts"`
Expected: 无 api.ts 相关错误（其他文件预先存在的错误可忽略）

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add services/api.ts
git commit -m "feat(course): add sequence lock and quiz fields to Course/Lesson types"
```

---

## Task 4: 顺序锁定工具 — sequence-lock.ts + 单元测试

**Files:**
- Create: `d:\zhao\strapi-course\utils\sequence-lock.ts`
- Create: `d:\zhao\strapi-course\tests\unit\sequence-lock.test.ts`

- [ ] **Step 1: 创建 sequence-lock.ts**

新建 `d:\zhao\strapi-course\utils\sequence-lock.ts`：

```typescript
// utils/sequence-lock.ts
// 课程/课时顺序锁定判定工具

/** 可锁定项接口 */
export interface LockableItem {
  documentId: string
  title: string
  sequenceNumber: number
  sequenceTag?: { documentId: string; name: string } | null
  enforceSequence: boolean
  isCompleted: boolean
}

/** 锁定判定结果 */
export interface LockResult {
  locked: boolean
  enforceMode: boolean  // true=硬锁, false=软提示
  reason: string        // 如「请先完成：Python基础」
  firstIncomplete?: LockableItem  // 前置未完成项
}

/** quizRetryCount 枚举转数字 */
export const RETRY_MAP: Record<string, number> = {
  no_retry: 0,
  retry_1: 1,
  retry_2: 2,
  retry_3: 3,
  retry_4: 4
}

/**
 * 检查目标项是否被顺序锁定
 * @param target 目标项
 * @param allItems 同一范围内的所有项（如同一课程的所有课时，或所有课程）
 * @returns 锁定结果
 */
export function checkItemLock(
  target: LockableItem,
  allItems: LockableItem[]
): LockResult {
  // 1. 未关联顺序标签或顺序号为0 → 不锁定
  if (!target.sequenceTag || target.sequenceNumber === 0) {
    return { locked: false, enforceMode: false, reason: '' }
  }

  // 2. 筛选同 sequenceTag 且 sequenceNumber < target.sequenceNumber 的前置项
  const prerequisites = allItems.filter(
    item =>
      item.sequenceTag?.documentId === target.sequenceTag?.documentId &&
      item.sequenceNumber > 0 &&
      item.sequenceNumber < target.sequenceNumber
  )

  // 3. 按 sequenceNumber 排序
  prerequisites.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  // 4. 找到第一个未完成的前置项
  const firstIncomplete = prerequisites.find(item => !item.isCompleted)

  if (firstIncomplete) {
    return {
      locked: true,
      enforceMode: target.enforceSequence,
      reason: `请先完成：${firstIncomplete.title}`,
      firstIncomplete
    }
  }

  return { locked: false, enforceMode: false, reason: '' }
}

/**
 * 判断课程是否完成（所有必修课时 isCompleted）
 * @param lessons 该课程的课时列表
 * @returns 是否完成
 */
export function isCourseCompleted(
  lessons: Array<{ isCompleted: boolean; isRequired: boolean }>
): boolean {
  const requiredLessons = lessons.filter(l => l.isRequired !== false)
  if (requiredLessons.length === 0) return true
  return requiredLessons.every(l => l.isCompleted)
}

/**
 * 判断答题按钮是否锁定
 * @param allowRetakeQuiz 课程是否允许重复答题
 * @param isPointsClaimed 课时是否已领分
 * @param earnedLessonIds 已领分的课时ID集合
 * @param lessonDocumentId 当前课时ID
 * @returns 是否锁定
 */
export function isQuizButtonLocked(
  allowRetakeQuiz: boolean,
  isPointsClaimed: boolean,
  earnedLessonIds: Set<string>,
  lessonDocumentId: string
): boolean {
  // 允许重复答题 → 永不锁定
  if (allowRetakeQuiz) return false
  // 否则按领分状态判断
  return isPointsClaimed || earnedLessonIds.has(lessonDocumentId)
}
```

- [ ] **Step 2: 创建单元测试**

新建 `d:\zhao\strapi-course\tests\unit\sequence-lock.test.ts`：

```typescript
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

    it('returns locked when prerequisite not completed', () => {
      const result = checkItemLock(items[1], items) // 课程2，前置课程1已完成
      // 课程1 isCompleted=true，所以课程2不锁定
      expect(result.locked).toBe(false)
    })

    it('returns locked when prerequisite not completed (chain)', () => {
      const result = checkItemLock(items[2], items) // 课程3，前置课程2未完成
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
```

- [ ] **Step 3: 运行测试验证通过**

Run: `cd d:\zhao\strapi-course && npx jest --config jest.unit.config.js tests/unit/sequence-lock.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add utils/sequence-lock.ts tests/unit/sequence-lock.test.ts
git commit -m "feat(course): add sequence-lock utils with unit tests"
```

---

## Task 5: 锁定弹窗组件 — SequenceLockDialog

**Files:**
- Create: `d:\zhao\strapi-course\components\sequence-lock-dialog\sequence-lock-dialog.vue`

- [ ] **Step 1: 创建 SequenceLockDialog 组件**

新建 `d:\zhao\strapi-course\components\sequence-lock-dialog\sequence-lock-dialog.vue`：

```vue
<template>
  <view v-if="visible" class="lock-dialog-mask" @click="$emit('update:visible', false)">
    <view class="lock-dialog" @click.stop>
      <text class="lock-icon">{{ enforceMode ? '⚠️' : '💡' }}</text>
      <text class="lock-title">{{ enforceMode ? '顺序学习提示' : '顺序学习建议' }}</text>
      <text class="lock-desc">{{ reason }}</text>
      <view class="lock-actions">
        <!-- 硬锁：只有「去学习」按钮 -->
        <view v-if="enforceMode" class="lock-btn lock-btn-primary" @click="$emit('goto')">
          <text>去学习前置内容</text>
        </view>
        <!-- 软锁：「按顺序学习」+「继续学习」 -->
        <template v-else>
          <view class="lock-btn lock-btn-primary" @click="$emit('goto')">
            <text>按顺序学习</text>
          </view>
          <view class="lock-btn lock-btn-secondary" @click="$emit('skip')">
            <text>继续学习</text>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  enforceMode: boolean  // true=硬锁, false=软提示
  reason: string        // 如「请先完成：Python基础」
}>()

defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'goto'): void     // 跳转前置项
  (e: 'skip'): void     // 软锁跳过
}>()
</script>

<style lang="scss" scoped>
.lock-dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-dialog {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lock-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.lock-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.lock-desc {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  margin-bottom: 30rpx;
  line-height: 1.5;
}

.lock-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.lock-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.lock-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.lock-btn-secondary {
  background: #f5f5f5;
  color: #666;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
cd d:\zhao\strapi-course
git add components/sequence-lock-dialog/sequence-lock-dialog.vue
git commit -m "feat(course): add SequenceLockDialog component"
```

---

## Task 6: 课程详情页 — 课时锁定 + 锁图标

**Files:**
- Modify: `d:\zhao\strapi-course\pages\course-detail\course-detail.vue`

- [ ] **Step 1: 新增 import 和状态**

在 `<script setup lang="ts">` 顶部新增 import：

```typescript
import { checkItemLock, type LockableItem, type LockResult } from '../../utils/sequence-lock'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'
```

在状态定义区域（如 `const lessons = ref(...)` 附近）新增：

```typescript
const lockDialogVisible = ref(false)
const lockResult = ref<LockResult>({ locked: false, enforceMode: false, reason: '' })
```

- [ ] **Step 2: 修改 startLearning 函数增加锁定检查**

将 `startLearning` 函数（约 206 行）替换为：

```typescript
function startLearning(index: number) {
  const lesson = lessons.value[index]

  // 顺序锁定检查
  const lockableItems: LockableItem[] = lessons.value.map(l => ({
    documentId: l.documentId,
    title: l.title,
    sequenceNumber: (l as any).sequenceNumber || 0,
    sequenceTag: (l as any).sequenceTag || null,
    enforceSequence: (l as any).enforceSequence ?? course.value?.enforceSequence ?? false,
    isCompleted: l.completed || false
  }))
  const result = checkItemLock(lockableItems[index], lockableItems)
  if (result.locked) {
    lockResult.value = result
    lockDialogVisible.value = true
    return
  }

  uni.setStorageSync('currentLessonId', lesson.documentId)
  uni.setStorageSync('currentCourseId', course.value?.documentId)
  if (lesson.progressId) {
    uni.setStorageSync('currentProgressId', String(lesson.progressId))
  }
  uni.navigateTo({
    url: `/pages/video-player/video-player?courseId=${course.value?.documentId}&lessonIndex=${index}`
  })
}
```

- [ ] **Step 3: 新增弹窗跳转处理函数**

在 `startLearning` 函数后新增：

```typescript
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockResult.value.firstIncomplete) {
    const idx = lessons.value.findIndex(l => l.documentId === lockResult.value.firstIncomplete?.documentId)
    if (idx >= 0) {
      // 直接跳转到前置课时（不再检查锁定，因为前置课时本身应该是可访问的）
      const lesson = lessons.value[idx]
      uni.setStorageSync('currentLessonId', lesson.documentId)
      uni.setStorageSync('currentCourseId', course.value?.documentId)
      if (lesson.progressId) {
        uni.setStorageSync('currentProgressId', String(lesson.progressId))
      }
      uni.navigateTo({
        url: `/pages/video-player/video-player?courseId=${course.value?.documentId}&lessonIndex=${idx}`
      })
    }
  }
}
```

- [ ] **Step 4: 在 template 中添加锁图标和弹窗组件**

在课时列表的 `lesson-status` 区域（约 53-56 行），替换为：

```vue
            <view class="lesson-status">
              <text v-if="lesson.completed" class="status-icon completed">✓</text>
              <text v-else-if="isLessonLocked(idx)" class="status-icon locked">🔒</text>
              <text v-else class="status-icon">▶</text>
            </view>
```

在 template 末尾（`</view>` 闭合标签前）添加弹窗组件：

```vue
    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockResult.enforceMode"
      :reason="lockResult.reason"
      @goto="handleLockGoto"
    />
```

- [ ] **Step 5: 新增 isLessonLocked 计算函数**

在 script 中新增：

```typescript
function isLessonLocked(index: number): boolean {
  const lesson = lessons.value[index]
  if (!(lesson as any).sequenceTag || !(lesson as any).sequenceNumber) return false
  const lockableItems: LockableItem[] = lessons.value.map(l => ({
    documentId: l.documentId,
    title: l.title,
    sequenceNumber: (l as any).sequenceNumber || 0,
    sequenceTag: (l as any).sequenceTag || null,
    enforceSequence: (l as any).enforceSequence ?? course.value?.enforceSequence ?? false,
    isCompleted: l.completed || false
  }))
  return checkItemLock(lockableItems[index], lockableItems).locked
}
```

- [ ] **Step 6: 新增锁图标样式**

在 `<style>` 中新增：

```scss
.status-icon.locked {
  color: #ccc;
}
```

- [ ] **Step 7: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/course-detail/course-detail.vue
git commit -m "feat(course): add lesson sequence lock to course-detail page"
```

---

## Task 7: 播放页 — 课时切换锁定 + 答题按钮锁定 + quizRetryCount 替换

**Files:**
- Modify: `d:\zhao\strapi-course\pages\video-player\video-player.vue`

这是最复杂的 Task，分为 4 个子步骤。

- [ ] **Step 1: 新增 import 和状态**

在 `<script setup lang="ts">` 顶部新增 import：

```typescript
import { checkItemLock, isQuizButtonLocked, RETRY_MAP, type LockableItem, type LockResult } from '../../utils/sequence-lock'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'
```

在状态定义区域新增：

```typescript
const lockDialogVisible = ref(false)
const lockResult = ref<LockResult>({ locked: false, enforceMode: false, reason: '' })
const pendingLessonIndex = ref(-1)  // 待跳转的课时索引（软锁跳过时用）
```

- [ ] **Step 2: 替换 quizRetryEnabled/quizMaxRetryCount 为课程级字段**

找到第 208-209 行：

```typescript
const quizRetryEnabled = ref(true)
const quizMaxRetryCount = ref(1)
```

替换为：

```typescript
// 错题复答次数（从课程级字段读取，替代全局 flag）
const quizRetryCount = ref(0)
```

找到第 379-380 行（加载 featureFlags 的地方）：

```typescript
          quizRetryEnabled.value = flagsRes.quizRetryEnabled !== false
          quizMaxRetryCount.value = flagsRes.quizMaxRetryCount ?? 1
```

替换为：

```typescript
          // 从课程级字段读取复答次数（替代全局 flag）
          quizRetryCount.value = RETRY_MAP[course.value?.quizRetryCount || 'no_retry'] ?? 0
```

找到第 119 行（模板中）：

```vue
              {{ isCorrect ? `🎉 回答正确！+${earnedPointsPerQuestion[currentQuestionIndex] || 0}积分` : '😅 回答错误' + (quizRetryEnabled && currentRetryCount <= quizMaxRetryCount ? '，请再试一次' : '') }}
```

替换为：

```vue
              {{ isCorrect ? `🎉 回答正确！+${earnedPointsPerQuestion[currentQuestionIndex] || 0}积分` : '😅 回答错误' + (quizRetryCount > 0 && currentRetryCount <= quizRetryCount ? '，请再试一次' : '') }}
```

找到第 137-138 行（模板中）：

```vue
          <view v-else-if="!isCorrect && quizRetryEnabled && currentRetryCount <= quizMaxRetryCount" class="retry-btn retry-again-btn" @click="retryCurrentQuestion">
            <text>再试一次 ({{ currentRetryCount }}/{{ quizMaxRetryCount }})</text>
```

替换为：

```vue
          <view v-else-if="!isCorrect && quizRetryCount > 0 && currentRetryCount <= quizRetryCount" class="retry-btn retry-again-btn" @click="retryCurrentQuestion">
            <text>再试一次 ({{ currentRetryCount }}/{{ quizRetryCount }})</text>
```

找到第 987-988 行：

```typescript
      currentRetryCount.value++
      const canRetry = quizRetryEnabled.value && currentRetryCount.value <= quizMaxRetryCount.value
```

替换为：

```typescript
      currentRetryCount.value++
      const canRetry = quizRetryCount.value > 0 && currentRetryCount.value <= quizRetryCount.value
```

- [ ] **Step 3: 修改 selectLesson 增加锁定检查**

找到第 557 行 `selectLesson` 函数，在「不同课时：防止切换中重复点击」（约 583 行）之前，即 `return` 之后、`// 不同课时` 之前，插入锁定检查：

```typescript
  // 不同课时：顺序锁定检查
  const lockableItems: LockableItem[] = lessons.value.map(l => ({
    documentId: l.documentId,
    title: l.title,
    sequenceNumber: (l as any).sequenceNumber || 0,
    sequenceTag: (l as any).sequenceTag || null,
    enforceSequence: (l as any).enforceSequence ?? (course.value as any)?.enforceSequence ?? false,
    isCompleted: l.completed || false
  }))
  const result = checkItemLock(lockableItems[index], lockableItems)
  if (result.locked) {
    lockResult.value = result
    pendingLessonIndex.value = index
    lockDialogVisible.value = true
    return
  }
```

- [ ] **Step 4: 修改 goToNext 增加锁定检查**

找到第 876 行 `goToNext` 函数，替换为：

```typescript
function goToNext() {
  if (currentLessonIndex.value < lessons.value.length - 1) {
    const nextIndex = currentLessonIndex.value + 1
    // 顺序锁定检查
    const lockableItems: LockableItem[] = lessons.value.map(l => ({
      documentId: l.documentId,
      title: l.title,
      sequenceNumber: (l as any).sequenceNumber || 0,
      sequenceTag: (l as any).sequenceTag || null,
      enforceSequence: (l as any).enforceSequence ?? (course.value as any)?.enforceSequence ?? false,
      isCompleted: l.completed || false
    }))
    const result = checkItemLock(lockableItems[nextIndex], lockableItems)
    if (result.locked) {
      lockResult.value = result
      pendingLessonIndex.value = nextIndex
      lockDialogVisible.value = true
      return
    }
    selectLesson(nextIndex)
  }
}
```

- [ ] **Step 5: 新增弹窗处理函数**

在 `goToNext` 函数后新增：

```typescript
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockResult.value.firstIncomplete) {
    const idx = lessons.value.findIndex(l => l.documentId === lockResult.value.firstIncomplete?.documentId)
    if (idx >= 0) {
      selectLesson(idx)
    }
  }
}

function handleLockSkip() {
  lockDialogVisible.value = false
  // 软锁跳过：继续播放用户想看的课时
  if (pendingLessonIndex.value >= 0) {
    const idx = pendingLessonIndex.value
    pendingLessonIndex.value = -1
    // 直接调用 selectLesson 的后半段逻辑（跳过锁定检查）
    switchingLesson.value = true
    videoLoading.value = true
    saveLearningProgress()
    if (currentLesson.value?.video_url && videoContext) {
      try { videoContext.pause() } catch (e) {}
    }
    isPlaying.value = false
    stopProgressSaveTimer()
    destroyAudioContext()
    currentLessonIndex.value = idx
    hasMarkedComplete = false
    hasTipResume.value = false
    const lesson = lessons.value[idx]
    duration.value = lesson?.duration || 0
    if (lesson?.completed) {
      completedLessonPending = true
    }
  }
}
```

- [ ] **Step 6: 修改答题按钮 UI 和 startQuiz 函数**

找到第 157-159 行（答题按钮），替换为：

```vue
      <view :class="['action-btn', 'primary', { disabled: isQuizButtonDisabled || todayQuizCount >= maxDailyQuiz }]" @click="startQuiz">
        <text>{{ quizButtonText }}</text>
      </view>
```

在 script 中新增 computed（需要先 import computed）：

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
```

```typescript
const isQuizButtonDisabled = computed(() => {
  return isQuizButtonLocked(
    course.value?.allowRetakeQuiz || false,
    (currentLesson.value as any)?.isPointsClaimed || false,
    earnedLessonIds.value,
    currentLesson.value?.documentId || ''
  )
})

const quizButtonText = computed(() => {
  if (isQuizButtonDisabled.value) return '已完成答题'
  if (todayQuizCount.value >= maxDailyQuiz.value) return '今日答题已达上限'
  return '开始答题'
})
```

找到第 894 行 `startQuiz` 函数开头，在 `if (!currentLesson.value?.completed)` 之前新增：

```typescript
  // 答题按钮锁定检查
  if (isQuizButtonDisabled.value) {
    uni.showToast({ title: '已完成答题，无法重复答题', icon: 'none' })
    return
  }
```

- [ ] **Step 7: 在 template 中添加弹窗组件**

在 template 末尾（`</view>` 闭合标签前，ChannelPicker 之后）添加：

```vue
    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockResult.enforceMode"
      :reason="lockResult.reason"
      @goto="handleLockGoto"
      @skip="handleLockSkip"
    />
```

- [ ] **Step 8: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/video-player/video-player.vue
git commit -m "feat(course): add lesson lock, quiz button lock, and quizRetryCount to video-player"
```

---

## Task 8: 首页 — 课程级锁定拦截

**Files:**
- Modify: `d:\zhao\strapi-course\pages\index\index.vue`

- [ ] **Step 1: 新增 import 和状态**

在 `<script setup lang="ts">` 顶部新增 import：

```typescript
import { checkItemLock, isCourseCompleted, type LockableItem, type LockResult } from '../../utils/sequence-lock'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'
```

在状态定义区域新增：

```typescript
const courseProgressMap = ref<Map<string, boolean>>(new Map())
const lockDialogVisible = ref(false)
const lockResult = ref<LockResult>({ locked: false, enforceMode: false, reason: '' })
```

- [ ] **Step 2: 新增加载课程进度的函数**

在 `loadCourses` 函数后新增：

```typescript
async function loadCourseProgresses() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getMyCourseProgresses()
    const progresses = res?.data || []
    const map = new Map<string, boolean>()
    progresses.forEach((p: any) => {
      const courseId = p.course?.documentId || p.course
      map.set(courseId, p.isCompleted || false)
    })
    courseProgressMap.value = map
  } catch (e) {
    console.error('加载课程进度失败', e)
  }
}
```

- [ ] **Step 3: 修改 goToCourseDetail 增加锁定检查**

找到 `goToCourseDetail` 函数，在函数开头（游客模式检查之前）新增：

```typescript
function goToCourseDetail(id: string) {
  // 课程级顺序锁定检查
  const targetCourse = courseList.value.find(c => c.documentId === id)
  if (targetCourse && (targetCourse as any).sequenceTag && (targetCourse as any).sequenceNumber > 0) {
    const lockableItems: LockableItem[] = courseList.value.map(c => ({
      documentId: c.documentId,
      title: c.title,
      sequenceNumber: (c as any).sequenceNumber || 0,
      sequenceTag: (c as any).sequenceTag || null,
      enforceSequence: (c as any).enforceSequence || false,
      isCompleted: courseProgressMap.value.get(c.documentId) || false
    }))
    const result = checkItemLock(
      lockableItems.find(i => i.documentId === id)!,
      lockableItems
    )
    if (result.locked) {
      lockResult.value = result
      lockDialogVisible.value = true
      return
    }
  }

  // 原有逻辑
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
```

注意：保留原有的 goToCourseDetail 函数体，只是在开头新增锁定检查。

- [ ] **Step 4: 新增弹窗处理函数**

在 `goToCourseDetail` 函数后新增：

```typescript
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockResult.value.firstIncomplete) {
    // 跳转到前置课程详情页
    uni.navigateTo({
      url: `/pages/course-detail/course-detail?courseId=${lockResult.value.firstIncomplete.documentId}`
    })
  }
}
```

- [ ] **Step 5: 修改 refreshData 加载课程进度**

找到 `refreshData` 函数，在 `loadCourses()` 后新增 `loadCourseProgresses()`：

```typescript
function refreshData() {
  getUserInfo()
  loadCategories()
  loadTags()
  debouncedLoadCourses()
  loadCourseProgresses()
  loadPointBalance()
  loadInviteCode()
  siteConfig.value = getStoredAuthConfig()
}
```

- [ ] **Step 6: 在 template 中添加弹窗组件**

在 template 末尾（筛选弹层之后）添加：

```vue
    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockResult.enforceMode"
      :reason="lockResult.reason"
      @goto="handleLockGoto"
    />
```

- [ ] **Step 7: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/index/index.vue
git commit -m "feat(course): add course-level sequence lock to homepage"
```

---

## Task 9: 端到端手工验证

**Files:** 无（仅验证）

- [ ] **Step 1: 重启 Strapi 后端**

Run: `cd d:\zhao\strapi && npm run develop`
Expected: Strapi 启动，自动执行 schema 迁移（新增字段）

- [ ] **Step 2: 在 Strapi 后台配置测试数据**

1. 进入 Content Manager → 课程
2. 创建 3 个课程，关联同一个 sequenceTag（如"测试系列"）
3. 课程1: sequenceNumber=1, enforceSequence=true
4. 课程2: sequenceNumber=2, enforceSequence=true
5. 课程3: sequenceNumber=3, enforceSequence=false（软锁）
6. 其他课程: sequenceTag=空（自由学习）
7. 为课程1创建 3 个课时，课时1: sequenceNumber=1, 课时2: sequenceNumber=2, 课时3: sequenceNumber=3，关联同一 sequenceTag，enforceSequence=true

- [ ] **Step 3: 启动前端 H5 服务器**

Run: `cd d:\zhao\strapi-course && npm run dev:h5`

- [ ] **Step 4: 验证首页课程级锁定**

- 未登录状态：自由访问所有课程（无进度数据，不锁定）
- 登录后未学习任何课程：点击课程2 → 弹窗「请先完成：课程1」，硬锁只有「去学习」按钮
- 点击课程3 → 弹窗「请先完成：课程1」，软锁有「按顺序学习」和「继续学习」
- 点击自由课程 → 正常跳转

- [ ] **Step 5: 验证课程详情页课时锁定**

- 进入课程1详情页
- 课时2、课时3 显示 🔒 图标
- 点击课时2 → 弹窗「请先完成：课时1」
- 课时1 不显示锁图标，可正常点击

- [ ] **Step 6: 验证播放页课时切换锁定**

- 进入课程1播放页，播放课时1
- 点击课时2 → 弹窗锁定
- 课时1播放完成（98%）后，点击课时2 → 正常切换
- 点击「下一节」按钮 → 同样检查锁定

- [ ] **Step 7: 验证答题按钮锁定**

- 课时1播放完成后，答题按钮显示「开始答题」
- 答题并领分成功后，按钮变为「已完成答题」置灰
- 点击置灰按钮 → toast「已完成答题，无法重复答题」
- 配置课程 allowRetakeQuiz=true → 按钮始终为「开始答题」，可重复答题

- [ ] **Step 8: 验证错题复答**

- 配置课程 quizRetryCount=retry_2
- 答错后显示「再试一次 (1/2)」
- 再错显示「再试一次 (2/2)」
- 第三次错 → 不显示重试按钮
- 配置 quizRetryCount=no_retry → 答错即结束，无重试

- [ ] **Step 9: 验证软锁跳过**

- 软锁弹窗点击「继续学习」→ 直接播放目标课时（跳过锁定）
- 软锁弹窗点击「按顺序学习」→ 跳转到前置课时

- [ ] **Step 10: 最终 Commit**

```bash
cd d:\zhao\strapi-course
git add -A
git commit -m "feat(course): complete sequence lock and quiz button lock"
```

---

## Self-Review Checklist

**1. Spec coverage**（对照设计文档）：
- ✅ 课程级顺序锁定（enforceSequence + sequenceTag + sequenceNumber）— Task 1, 8
- ✅ 课时级顺序锁定（enforceSequence + sequenceTag）— Task 2, 6, 7
- ✅ 硬锁/软锁弹窗 — Task 5, 6, 7, 8
- ✅ 答题按钮锁定（allowRetakeQuiz + isPointsClaimed）— Task 7
- ✅ 错题复答字段下沉（quizRetryCount 枚举）— Task 1, 7
- ✅ 前端判定方案（方案A）— Task 4 (checkItemLock)
- ✅ course-progress 复用（卡点修复）— Task 8 (loadCourseProgresses)
- ✅ 不涉及答题领分逻辑 — 确认未修改 claimQuizPoints 流程

**2. 卡点修复清单**：
- ✅ course-progress 表已有 isCompleted → Task 8 直接用 getMyCourseProgresses()
- ✅ quizRetryEnabled/quizMaxRetryCount 13 处引用 → Task 7 全部替换为 quizRetryCount
- ✅ Lesson 类型不完整 → Task 3 补全字段
- ✅ 答题按钮 UI 位置（行 157-159）→ Task 7 Step 6 明确修改
- ✅ selectLesson（行 557）和 goToNext（行 876）→ Task 7 Step 3/4 明确修改

**3. Placeholder scan**：无 TBD/TODO，所有代码步骤含完整代码。

**4. Type consistency**：
- `LockableItem` / `LockResult` 在 Task 4 定义，Task 6/7/8 引用一致
- `RETRY_MAP` 在 Task 4 定义，Task 7 引用一致
- `checkItemLock` / `isCourseCompleted` / `isQuizButtonLocked` 函数名在 Task 4 定义，后续引用一致
- `quizRetryCount` 变量名在 Task 7 中一致使用（替代 quizRetryEnabled/quizMaxRetryCount）

**5. 不涉及范围确认**：
- ❌ 未修改 claimQuizPoints 函数
- ❌ 未修改答题流程内部逻辑（题目展示、判题）
- ❌ 未修改积分计算
- ❌ 未修改播放进度上报逻辑（saveLearningProgress）
