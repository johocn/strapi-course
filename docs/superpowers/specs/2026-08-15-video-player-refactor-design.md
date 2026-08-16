# 音视频播放页纯函数拆分与回归防护 设计文档

**日期**: 2026-08-15
**状态**: 已确认
**范围**: strapi-course 前端 `pages/video-player/video-player.vue`

---

## 1. 背景与目标

### 1.1 背景

`pages/video-player/video-player.vue` 目前为 1543 行的单文件，混合了多个职责：

- 音视频播放控制（video context、seek、事件处理）
- 学习进度保存（定时上报、完成判定、领分）
- 课时导航与顺序锁定（`selectLesson`、`checkItemLock`）
- 答题系统（开始/判题/重试/得分）
- 积分领取（渠道选择器、一次性积分确认）
- 续播/完成弹窗决策
- 微信分享配置

上次开发"顺序播放"功能时，改动破坏了已开发好的功能且恢复困难。根因是核心判定逻辑（续播决策、答题判定、领分汇总）内嵌在巨型单文件里无法独立测试，任何周边改动都可能误伤这些逻辑。

### 1.2 目标

1. **拆分代码**：把纯计算逻辑从 `video-player.vue` 抽离到 `utils/`，减小单文件体积。
2. **业务逻辑纯函数化**：将续播决策、答题判定、领分渠道判定等核心逻辑抽取为可独立解释、可独立测试的纯函数。
3. **建立自动化测试（回归保护）**：为抽出的每个纯函数编写单元测试，后续改动后跑测试即可验证旧有判定未被破坏。

核心原则：**行为不变的抽取**。所有函数签名从现有代码原样提炼，不改变任何判定结果，不引入新功能。

### 1.3 不涉及范围（明确排除）

- ❌ 不拆分 Vue composables / 子组件（后续阶段）
- ❌ 不改变任何播放/答题/领分的既有行为
- ❌ 不改动后端、不改动 API 接口
- ❌ 不重构 `video-player.vue` 的副作用逻辑（发请求、控制 video、弹窗、toast）
- ❌ 不引入新的第三方依赖

---

## 2. 总体方案

按职责横向拆出 4 个纯函数模块，每个模块配一个单元测试文件：

```
utils/
├── player-data.ts        # 数据归一化与富化
├── player-playback.ts    # 播放决策与时间格式化
├── quiz-logic.ts         # 答题判定与积分计算
└── points-store.ts       # 领分渠道决策与标签
tests/unit/
├── player-data.test.ts
├── player-playback.test.ts
├── quiz-logic.test.ts
└── points-store.test.ts
```

`video-player.vue` 保留所有状态（ref）与副作用（API 调用、`uni.*`、video context），仅调用这些纯函数。

---

## 3. 模块 1：`utils/player-data.ts` — 数据归一化与富化

**职责**：把 API 返回的各种数据形态（数组 / `{data:[...]}` / 单对象）统一为数组，构建进度对照，富化课时。纯函数，无副作用，不碰 ref。

| 函数 | 对应现有代码 | 输入 → 输出 | 说明 |
|---|---|---|---|
| `normalizeList(data)` | `loadData` 340-356 | `any` → `any[]` | 数组直返；`{data:[...]}` 展开；`{data:obj}` 包成数组；其他返回 `[]`。**最易回归点** |
| `buildProgressMap(progressData)` | 358-363 | `any[]` → `Map<string,any>` | 以 `lesson.documentId` 为 key，防 number/string 类型不一致 |
| `enrichLessons(lessonData, progressMap)` | 373-387 | `(Lesson[], Map)` → `Lesson[]` | 追加 `completed/progressPercent/progressId/playPosition/progressDuration` |
| `findFirstIncompleteIndex(lessons)` | 390-392 | `Lesson[]` → `number` | 第一个未完成课时下标，无则 `-1` |
| `extractEarnedLessonIds(records)` | 417-425 | `any[]` → `Set<string>` | 从积分流水抽已领课时 id（`String(r.source)`） |
| `countTodayQuizRecords(records, todayStr)` | 418-423 | `(any[], string)` → `number` | 统计今日答题次数 |

**边界**：只做数据转换与统计，不发起请求、不读写 ref、不调用 `uni.*`。

---

## 4. 模块 2：`utils/player-playback.ts` — 播放决策与时间格式化

**职责**：围绕"这课时该怎么播"的纯判定逻辑。核心是续播/完成/从头三态决策，加上时间格式化。不碰 video context、不触发播放副作用。

| 函数 | 对应现有代码 | 输入 → 输出 | 说明 |
|---|---|---|---|
| `decidePlaybackAction(lesson, alreadyPrompted)` | `offerLessonPlayback` 512-551 | `(Lesson, Set<string>)` → `PlaybackAction` | 核心三态决策，返回动作而非直接播放 |
| `formatTime(seconds)` | 740-744 | `number` → `string` | `MM:SS`，如 `03:05` |
| `formatDuration(val)` | 746-757 | `any` → `string` | `X小时Y分钟Z秒`，空值返回 `''` |
| `computeProgress(currentTime, duration)` | `onTimeUpdate` 608-610 | `(number, number)` → `number \| null` | 百分比；`duration<=0` 时返回 `null`（表示不可算），由调用方决定是否更新进度，与现有"不更新保持原值"行为一致 |

### 4.1 `PlaybackAction` 类型

```ts
type PlaybackAction =
  | { type: 'show_resume'; position: number }      // 有进度 → 弹续播框
  | { type: 'show_completed'; }                     // 已完成且未提示过 → 弹完成框
  | { type: 'resume'; position: number }            // 会话内已提示过 + 有进度 → 静默断点续播
  | { type: 'restart'; }                            // 会话内已提示过 + 已完成 → 静默从头
  | { type: 'start'; }                              // 无进度 → 静默从头（等待点击播放）
```

### 4.2 决策规则（严格复刻现有 if/else 顺序）

1. `alreadyPrompted.has(lesson.documentId)` 为真：
   - `lesson.completed` 为真 → `restart`
   - `lesson.playPosition > 0` → `resume`
   - 否则 → `start`
2. 否则 `lesson.completed` 为真 → `show_completed`
3. 否则 `lesson.playPosition > 0` → `show_resume`
4. 否则 → `start`

**边界**：`decidePlaybackAction` 只返回动作类型，不弹窗、不 seek、不播放。`video-player.vue` 拿到动作后再做副作用（设 ref、调 `playLessonFrom`）。

---

## 5. 模块 3：`utils/quiz-logic.ts` — 答题判定与积分计算

**职责**：答题全流程的纯逻辑。这些正是上次顺序播放改动时最容易误伤、且恢复费劲的核心逻辑。

| 函数 | 对应现有代码 | 输入 → 输出 | 说明 |
|---|---|---|---|
| `isCorrectAnswer(answer, key)` | 854-858 | `(any, string)` → `boolean` | 答案可能是数组或单值，统一 `String` 比较 |
| `toggleSelection(currentSelected, key, questionType)` | 860-874 | `(string[], string, string)` → `string[]` | 单选/判断替换为 `[key]`，多选切换增删 |
| `computeEarnedPoints(isCorrect, pointsConfig, isPracticeMode, question, perQuestionPoints)` | 890-900 | 多参 → `number` | 答对且积分开启且非练习模式才得分；quiz_points 用题目 points，否则用 perQuestionPoints |
| `canRetryAnswer(quizRetryEnabled, currentRetryCount, quizMaxRetryCount)` | 904 | `(bool, number, number)` → `boolean` | `enabled && current <= max` |
| `isQuizPracticeMode(earnedLessonIds, lessonDocumentId)` | 816-819 | `(Set<string>, string)` → `boolean` | 已领分 → 练习模式 |
| `canTakeFormalQuiz(isPracticeMode, todayCount, maxDaily)` | 822-825 | 多参 → `boolean` | 练习模式不限；正式答题受每日上限约束 |
| `sumEarnedPoints(earnedPointsPerQuestion)` | 929 | `number[]` → `number` | 汇总本场得分 |

**边界**：纯计算，不调用 `uni.showToast`、不改 ref、不发请求。判定结果由 `video-player.vue` 决定 UI 动作。

**回归防护重点**：
- `isCorrectAnswer` 的数组/单值兼容（模板 83 行也在用，改动必须同步）
- `canRetryAnswer` 与模板 94/112 行 `quizRetryEnabled && currentRetryCount <= quizMaxRetryCount` 的一致性——抽成同一函数消除"模板一逻辑、脚本一逻辑"的漂移
- `computeEarnedPoints` 的三种积分模式分支（答题领分正确性核心）

---

## 6. 模块 4：`utils/points-store.ts` — 领分渠道决策与标签

**职责**：积分领取链路中"渠道"相关的纯逻辑。`tryClaimLessonPoints`（课时领分）和 `doClaimFlow`（答题领分）两处渠道判定分散在各自流程中，条件各异（课时领分用 `shouldShowChannelPicker`，答题领分用 `shouldFetchAvailableChannels`），抽成命名清晰、可单测的共享函数，统一渠道处理逻辑并便于后续维护。

| 函数 | 对应现有代码 | 输入 → 输出 | 说明 |
|---|---|---|---|
| `shouldShowChannelPicker(channelScope, channelIds, flag)` | 708-710 | `(string, any[], bool)` → `boolean` | 课时领分：`specific` + `channel_cross_points=true` + 多候选渠道 → 弹选择器 |
| `shouldFetchAvailableChannels(channelConfig, knownChannels)` | 970-974 | `(any, any[])` → `boolean` | 答题领分：`all` 范围，或 `specific` 但一个渠道都没有 → 拉取可用渠道 |
| `buildChannelOptions(channelIds)` | 961-967 | `any[]` → `{documentId,name,id}[]` | specific 模式：id 数组 → 完整对象（name 兜底为 id） |
| `dedupeChannels(channels)` | 979 | `any[]` → `any[]` | 按 documentId 去重保留完整对象 |
| `buildChannelLabels(channelIds, defaultChannelId)` | 725-728 | `(any[], any)` → `string[]` | 渠道标签，默认渠道追加"（默认）" |
| `isDefaultChannel(id, defaultChannelId)` | 726 | `(any, any)` → `boolean` | `String` 比较判断是否默认渠道 |
| `normalizeChannelId(id)` | — | `any` → `string` | 统一 `String()` 转换，消除类型不一致 |

**边界**：只做渠道列表/标签/判定，不发起可用渠道请求、不弹 `uni.showActionSheet`。拉取请求与弹窗副作用留在 `video-player.vue`。

**关键收益**：课时领分与答题领分两处渠道判定目前分散在各自流程中且条件微妙（`specific` 空渠道时 `shouldFetchAvailableChannels` 为真、`needPicker` 只在 `availableChannels.length > 1`）。抽成命名清晰、可单测的共享函数后，渠道处理逻辑统一、行为可验证，便于后续维护。

---

## 7. `video-player.vue` 改动

- 顶部新增 4 个 import，引入上述纯函数。
- 各函数调用点替换为模块函数调用（保持变量赋值与副作用逻辑不变）。
- 删除被替换的本地函数定义（`formatTime`、`formatDuration`、`isCorrectAnswer` 等）。
- 文件体积从 1543 行下降约 300+ 行（纯逻辑移出），保留所有状态与副作用。

> 注意：本文件属于 HBuilder X 环境（d:\zhao\strapi-course），修改源码后由用户在 HBuilder X 中手动编译，禁止代为执行构建/依赖安装命令。

---

## 8. 单元测试设计

沿用现有 `jest.unit.config.js`（`testEnvironment: node`、`ts-jest`、`tests/unit/**/*.test.ts`）。每个模块一个测试文件，覆盖：

- `player-data.test.ts`：`normalizeList` 的数组/`{data}`/单对象/空值分支；`buildProgressMap` 的 documentId 匹配；`enrichLessons` 的全字段映射；`findFirstIncompleteIndex`；`extractEarnedLessonIds`/`countTodayQuizRecords`。
- `player-playback.test.ts`：`decidePlaybackAction` 的 5 种动作全分支 + 决策顺序；`formatTime`/`formatDuration`/`computeProgress` 边界（0、负值、空值）。
- `quiz-logic.test.ts`：`isCorrectAnswer` 数组/单值；`toggleSelection` 单选/多选；`computeEarnedPoints` 三种积分模式；`canRetryAnswer`；`isQuizPracticeMode`；`canTakeFormalQuiz`（练习/正式/上限）；`sumEarnedPoints`。
- `points-store.test.ts`：`shouldShowChannelPicker`/`shouldFetchAvailableChannels` 各分支；`buildChannelOptions`/`dedupeChannels`/`buildChannelLabels`/`isDefaultChannel`/`normalizeChannelId`。

测试命令：`npm run test:unit`（或 `npx jest --config jest.unit.config.js`，以现有脚本为准）。

---

## 9. 验收标准

1. `video-player.vue` 中所有纯判定逻辑已抽离到 4 个 `utils/` 模块，本地函数删除。
2. 4 个单测文件全部通过（`npx jest --config jest.unit.config.js`）。
3. 行为不变：抽取后无需改动任何判定结果；续播三态、答题判定、领分渠道判定与抽取前完全一致。
4. 用户在 HBuilder X 重新编译后，播放/答题/领分/顺序锁定功能表现与改动前一致。

---

## 10. 兼容性与风险

- 纯函数从现有代码原样提炼，不改变行为，无回归风险于既有功能。
- `isCorrectAnswer` 与 `canRetryAnswer` 被模板与脚本共用，改为统一函数后模板/脚本逻辑保持一致（消除漂移）。
- 不涉及后端、不涉及 API 契约、不引入依赖。
- 唯一风险：抽取时函数签名与现有调用点不一致导致编译错误——通过单测 + HBuilder X 编译双重验证规避。