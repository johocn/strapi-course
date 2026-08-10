# 课程播放顺序锁定与答题按钮锁定 设计文档

**日期**: 2026-08-10
**状态**: 已确认
**范围**: strapi-course 前端 + strapi 后端 zhao-course 插件

---

## 1. 概述

### 1.1 目标

为课程播放增加顺序锁定功能：课程和课时都可配置按顺序学习，前置未完成时不允许跳播后续内容。同时为答题按钮增加锁定逻辑，领分完成后不可重复答题（除非课程允许）。

### 1.2 核心需求

1. **顺序播放锁定**：课程和课时都可配置「按顺序播放」，前置未完成时不允许跳播
2. **锁定模式**：硬锁（强制顺序）和软锁（建议顺序，可跳过）
3. **答题按钮锁定**：领分成功后锁定答题按钮，不可重复答题
4. **错题复答**：从全局 flag 下沉为课程级枚举字段
5. **领分后重答**：课程级开关，允许领分后重新答题

### 1.3 不涉及范围（明确排除）

- ❌ 答题领分逻辑（`claimQuizPoints` 流程保持现状）
- ❌ 答题流程内部逻辑（题目展示、判题）
- ❌ 积分计算与发放
- ❌ 现有播放进度上报逻辑

---

## 2. 数据模型变更

### 2.1 `course/schema.json` 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enforceSequence` | boolean | false | 顺序播放硬锁开关。true=硬锁，false=软提示 |
| `sequenceNumber` | integer | 0 | 顺序号，0=不参与顺序学习（复用已有字段） |
| `sequenceTag` | relation M2O → `plugin::zhao-tag.tag` | null | 顺序组标签，复用 zhao-tag，为空则不参与顺序 |
| `allowRetakeQuiz` | boolean | false | 领分后是否允许重新答题。true=可重复答题，false=领分后锁定 |
| `quizRetryCount` | enum: `no_retry`/`retry_1`/`retry_2`/`retry_3`/`retry_4` | `no_retry` | 错题复答次数枚举 |

### 2.2 `course-lesson/schema.json` 新增字段

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enforceSequence` | boolean | false | 顺序播放硬锁开关。true=硬锁，false=软提示 |
| `sequenceTag` | relation M2O → `plugin::zhao-tag.tag` | null | 顺序组标签，复用 zhao-tag，为空则不参与顺序 |

> 注：课时已有 `sequenceNumber` 字段（用于课时列表排序），直接复用。

### 2.3 `quizRetryCount` 枚举映射

| 枚举值 | 含义 | 前端 retryCount |
|---|---|---|
| `no_retry` | 不允许复答（默认） | 0 |
| `retry_1` | 允许复答1次 | 1 |
| `retry_2` | 允许复答2次 | 2 |
| `retry_3` | 允许复答3次 | 3 |
| `retry_4` | 允许复答4次 | 4 |

前端转换函数：
```typescript
const RETRY_MAP: Record<string, number> = {
  no_retry: 0, retry_1: 1, retry_2: 2, retry_3: 3, retry_4: 4
}
const retryCount = RETRY_MAP[course.quizRetryCount] ?? 0
```

### 2.4 字段含义

- **`sequenceTag = null`**：不参与顺序学习，自由访问
- **`sequenceTag ≠ null` 且 `sequenceNumber > 0`**：同 tag 内按 sequenceNumber 排序
- **`enforceSequence = true`**：硬锁（必须按顺序，弹窗只有「去学习」按钮）
- **`enforceSequence = false`**：软提示（可跳过，弹窗有「按顺序学习」和「继续学习」两个按钮）

### 2.5 与 zhao-tag 的关系

`sequenceTag` 是 M2O 关系指向 `plugin::zhao-tag.tag`，复用已有标签组件。运营在 zhao-tag 管理页面创建标签（如"入门系列"、"进阶系列"），然后在课程/课时编辑页选择该标签作为 sequenceTag。不强制关联，可为空。

---

## 3. 判定规则

### 3.1 顺序锁定判定算法

```
检查目标项是否被锁定：
1. 如果 target.sequenceTag 为 null 或 sequenceNumber === 0 → 不锁定
2. 筛选同 sequenceTag 且 sequenceNumber < target.sequenceNumber 的前置项
3. 找到第一个 isCompleted=false 的前置项
4. 如果存在未完成前置项：
   - locked = true
   - enforceMode = target.enforceSequence
   - reason = `请先完成：${firstIncomplete.title}`
   - firstIncomplete = 该前置项
5. 否则 locked = false
```

### 3.2 课程完成判定

```
课程完成 = 该课程所有 isRequired=true 的课时 isCompleted=true
```

### 3.3 课时「完全完成」定义

```
课时完全完成 = isCompleted === true
  && (无答题 || course.allowRetakeQuiz === true || isPointsClaimed === true)
```

- 无答题的课时：播放完成即完全完成
- 有答题的课时（`allowRetakeQuiz=false`）：播放完成 + 领分成功才算完全完成
- `allowRetakeQuiz=true` 时：播放完成即视为完全完成（答题非强制，可重复）

### 3.4 优先级

课时级 `enforceSequence` 优先于课程级。课时未显式设置（`enforceSequence=false`）时继承课程级设置。

---

## 4. 答题按钮锁定逻辑

### 4.1 判定标准

领分成功后才锁定（`allowRetakeQuiz=false` 时）。允许重复答题（`allowRetakeQuiz=true`）时跳过所有锁定校验。

### 4.2 按钮状态

| `allowRetakeQuiz` | `isPointsClaimed` | 按钮文案 | 可点击 | 样式 |
|---|---|---|---|---|
| true | 任意 | 「开始答题」 | ✅ | 正常高亮 |
| false | false | 「开始答题」 | ✅ | 正常高亮 |
| false | true | 「已完成答题」 | ❌ | 置灰 |

### 4.3 锁定流程

```
用户点击「开始答题」
  │
  ├─ 检查0: course.allowRetakeQuiz === true?
  │    └─ 是 → 跳过所有锁定校验，直接进入答题流程
  │
  ├─ 检查1: lesson.isPointsClaimed === true?
  │    └─ 是 → toast「已完成答题，无法重复答题」→ return
  │
  ├─ 检查2: earnedLessonIds.includes(lesson.documentId)?
  │    └─ 是 → toast「已完成答题，无法重复答题」→ return
  │
  ├─ 检查3: lesson.completed === false?
  │    └─ 是 → toast「请先完成课时播放」→ return
  │
  └─ 通过所有检查 → 正常进入答题流程
```

### 4.4 数据来源（双重判断）

- `lesson-progress.isPointsClaimed` 字段
- `getPointRecordList({ action: 'quiz_pass' })` 的 `source` 字段（即 lessonDocumentId）
- 两者取或：任一为真则视为已领分

### 4.5 状态管理

```typescript
const isQuizLocked = computed(() => {
  if (course.value?.allowRetakeQuiz) return false
  return lesson.value?.isPointsClaimed === true 
    || earnedLessonIds.value.includes(lesson.value?.documentId)
})

const quizButtonText = computed(() => {
  if (isQuizLocked.value) return '已完成答题'
  if (lesson.value?.completed) return '开始答题'
  return '请先完成播放'
})
```

---

## 5. 错题复答字段下沉

### 5.1 变更说明

将全局 feature flag `quizRetryEnabled` 和 `quizMaxRetryCount` 下沉为课程级字段 `quizRetryCount`。

### 5.2 前端变量替换

| 旧变量（全局 flag） | 新变量（课程字段） | 来源 |
|---|---|---|
| `featureFlags.quizRetryEnabled` | `course.quizRetryCount !== 'no_retry'` | 布尔判断 |
| `featureFlags.quizMaxRetryCount` | `RETRY_MAP[course.quizRetryCount] ?? 0` | 枚举映射 |

替换位置：`video-player.vue` 答题流程（约 894-1114 行）和 `quiz.vue`。

替换示例：
```
旧: if (quizRetryEnabled && currentRetryCount <= quizMaxRetryCount)
新: const retryCount = RETRY_MAP[course.quizRetryCount] ?? 0
    if (retryCount > 0 && currentRetryCount <= retryCount)
```

### 5.3 全局 flag 处理

| 全局 flag | 处理方式 |
|---|---|
| `quizRetryEnabled` | 废弃（被 `course.quizRetryCount` 替代） |
| `quizMaxRetryCount` | 废弃（被 `course.quizRetryCount` 替代） |
| `maxDailyQuiz` | 保留（每日答题上限仍为全局控制） |
| `channel_cross_points` | 保留（渠道选择仍为全局控制） |

> 注：`getPointFeatureFlags` 接口仍保留（`maxDailyQuiz` 等还在用），只是前端不再读 `quizRetryEnabled` 和 `quizMaxRetryCount`。

---

## 6. 前端组件设计

### 6.1 新建 `utils/sequence-lock.ts`

```typescript
export interface LockableItem {
  documentId: string
  title: string
  sequenceNumber: number
  sequenceTag?: { documentId: string; name: string } | null
  enforceSequence: boolean
  isCompleted: boolean
}

export interface LockResult {
  locked: boolean
  enforceMode: boolean  // true=硬锁, false=软提示
  reason: string        // 如「请先完成：Python基础」
  firstIncomplete?: LockableItem  // 前置未完成项
}

/** 检查单个项目是否被锁定 */
export function checkItemLock(
  target: LockableItem,
  allItems: LockableItem[]
): LockResult

/** 课程完成判定：所有必修课时 isCompleted */
export function isCourseCompleted(
  lessons: Array<{ isCompleted: boolean; isRequired: boolean }>
): boolean

/** quizRetryCount 枚举转数字 */
export const RETRY_MAP: Record<string, number> = {
  no_retry: 0, retry_1: 1, retry_2: 2, retry_3: 3, retry_4: 4
}
```

### 6.2 新建 `components/sequence-lock-dialog/sequence-lock-dialog.vue`

```vue
<template>
  <view v-if="visible" class="lock-dialog-mask" @click="$emit('update:visible', false)">
    <view class="lock-dialog" @click.stop>
      <text class="lock-icon">{{ enforceMode ? '⚠️' : '💡' }}</text>
      <text class="lock-title">{{ enforceMode ? '顺序学习提示' : '顺序学习建议' }}</text>
      <text class="lock-desc">{{ reason }}</text>
      <view class="lock-actions">
        <view v-if="enforceMode" class="lock-btn lock-btn-primary" @click="$emit('goto')">
          <text>去学习前置课时</text>
        </view>
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
```

Props: `visible`, `enforceMode`, `reason`
Events: `goto`（跳转前置项）, `skip`（软锁跳过）, `update:visible`

### 6.3 弹窗 UI

**硬锁弹窗：**
```
┌─────────────────────────┐
│  ⚠️ 顺序学习提示          │
│                         │
│  请先完成前置课时：        │
│  「Python基础语法」       │
│                         │
│      [去学习前置课时]     │
└─────────────────────────┘
```

**软锁弹窗：**
```
┌─────────────────────────┐
│  💡 顺序学习建议          │
│                         │
│  建议先完成前置课时：      │
│  「Python基础语法」       │
│                         │
│  [按顺序学习]  [继续学习] │
└─────────────────────────┘
```

---

## 7. 页面改动

### 7.1 `pages/index/index.vue`（课程级锁定）

- 加载课程列表后，调用 `getMyLessonProgresses()` 获取所有课程进度
- 用 `isCourseCompleted` 计算每个课程完成状态
- 点击课程前 `checkItemLock` 检查
- 锁定则弹 `SequenceLockDialog`，弹窗「去学习」跳转到前置课程

### 7.2 `pages/course-detail/course-detail.vue`（课时锁定 + 锁图标）

- 课时列表按 `sequenceTag` 分组显示顺序链
- 点击课时前 `checkItemLock` 检查
- 硬锁课时显示 🔒，软锁课时显示 💡
- 锁定则弹 `SequenceLockDialog`，弹窗「去学习」跳转到前置课时

### 7.3 `pages/video-player/video-player.vue`（课时切换锁定 + 答题按钮锁定）

- 上一节/下一节/侧边栏点击课时前 `checkItemLock` 检查
- 答题按钮：新增 `isQuizLocked` computed（含 `allowRetakeQuiz` 判断）
- 答题按钮文案/样式按状态切换
- 错题复答：`quizRetryEnabled`/`quizMaxRetryCount` 替换为 `course.quizRetryCount`
- 锁定则弹 `SequenceLockDialog`

### 7.4 `services/api.ts`（类型定义更新）

- `Course` 类型新增：`enforceSequence`, `sequenceNumber`, `sequenceTag`, `allowRetakeQuiz`, `quizRetryCount`
- `Lesson` 类型新增：`enforceSequence`, `sequenceTag`

---

## 8. 锁定状态计算时机

| 场景 | 计算时机 | 数据来源 |
|---|---|---|
| 首页课程列表 | 加载课程列表后 | `getMyLessonProgresses`（所有课程） |
| 课程详情页 | 加载课时列表后 | `getMyLessonProgresses(courseId)` |
| 播放页课时切换 | 用户点击课时时 | 已加载的课时进度数据 |

---

## 9. 边界情况处理

| 场景 | 处理方式 |
|---|---|
| 答题领分失败（网络错误） | 按钮显示「领取积分」，允许重试（不在本次范围，保持现状） |
| 用户退出后重进 | 检查 `isPointsClaimed` + 积分流水，恢复按钮状态 |
| 管理员后台修改了题目 | 不影响已领分的用户，按钮仍锁定 |
| 课时无答题但有 quiz_points 类型 | 按 `lesson_points` 处理，播放完成即领分（保持现状） |
| 积分流水存在但 `isPointsClaimed=false` | 以积分流水为准，按钮锁定，前端同步更新 `isPointsClaimed` |
| `sequenceTag` 被删除 | 该课程/课时不再参与顺序学习，自由访问 |
| 同一课程内多个 `sequenceTag` 分组 | 各组独立计算，互不影响 |
| 跨课程前置课程未购买 | 弹窗提示「请先学习前置课程」，不涉及购买逻辑 |

---

## 10. 使用场景示例

### 10.1 10 个课程，5 个需要按顺序

| 课程 | sequenceTag | sequenceNumber | enforceSequence | 效果 |
|---|---|---|---|---|
| 课程1 | tag: "入门系列" | 1 | true | 必须第一个学 |
| 课程2 | tag: "入门系列" | 2 | true | 课程1完成后才能学 |
| 课程3 | tag: "入门系列" | 3 | true | 以此类推 |
| 课程4 | tag: "入门系列" | 4 | true | |
| 课程5 | tag: "入门系列" | 5 | true | |
| 课程6 | null | 0 | false | 自由学习 |
| 课程7 | null | 0 | false | 自由学习 |

### 10.2 错题复答配置

| 课程 | quizRetryCount | allowRetakeQuiz | 效果 |
|---|---|---|---|
| 正式课程 | no_retry | false | 答错即结束，领分后锁定 |
| 练习课程 | retry_4 | true | 可复答4次，领分后仍可重答 |
| 考试模拟 | retry_1 | false | 可复答1次，领分后锁定 |

---

## 11. Strapi 后台编辑页 UI

| 字段 | 控件类型 |
|---|---|
| `enforceSequence` | boolean toggle 开关 |
| `sequenceNumber` | integer 输入框 |
| `sequenceTag` | relation 选择器（自动渲染 zhao-tag 下拉） |
| `allowRetakeQuiz` | boolean toggle 开关 |
| `quizRetryCount` | enum select 下拉（5 个选项） |

---

## 12. 文件结构

```
strapi-course/
├── utils/
│   └── sequence-lock.ts                    # 新建：顺序锁定判定工具
├── components/
│   └── sequence-lock-dialog/
│       └── sequence-lock-dialog.vue        # 新建：锁定弹窗（硬锁/软锁）
├── services/
│   └── api.ts                              # 修改：Course/Lesson 类型新增字段
├── pages/
│   ├── index/index.vue                     # 修改：课程级锁定拦截
│   ├── course-detail/course-detail.vue     # 修改：课时锁定 + 锁图标显示
│   └── video-player/video-player.vue       # 修改：课时切换锁定 + 答题按钮锁定 + quizRetryCount替换
└── strapi/
    └── plugins/zhao-course/server/src/content-types/
        ├── course/schema.json              # 修改：新增5字段
        └── course-lesson/schema.json       # 修改：新增2字段
```

---

## 13. 兼容性

- 现有课程/课时未配置 `sequenceTag` 时默认不参与顺序学习，行为不变
- 现有课程未配置 `quizRetryCount` 时默认 `no_retry`，行为与旧 `quizRetryEnabled=false` 一致
- 现有课程未配置 `allowRetakeQuiz` 时默认 `false`，行为不变
- `getPointFeatureFlags` 接口保留，`maxDailyQuiz` 等仍正常工作
- 现有播放进度上报逻辑不变
