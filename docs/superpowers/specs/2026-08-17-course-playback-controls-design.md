# 课程播放控制与展示标记增强设计文档

> 日期: 2026-08-17
> 状态: 已批准
> 关联仓库: `d:\zhao\strapi`（后端 zhao-course / zhao-common）、`d:\zhao\strapi-course`（C端）

## 1. 概述

为课程增加播放控制能力与展示标记，包含两大块：

**播放控制（播放器）**：
- 方案 A：自定义控制条（替换原生 controls）
- 倍速播放、横竖屏、防误触锁定、画中画小窗（H5）、倍速记忆、自动连播
- 进度控制（seekMode）：锁定 / 仅已播区域 / 自由拖动
- 特定角色会员可打破倍速限制（VIP 特权）

**展示标记（列表/卡片）**：
- 课程角标：精品 / 推荐 / 新
- 综合推荐排序与筛选扩展

**核心机制**：课程新增 `featureFlags`（json）控制字段作为"功能开关中枢"，未配置 = 全部关闭（向后兼容），后续新增开关只改 JSON 不动 schema。所有播放功能默认关闭，由课程显式开启。

## 2. 现有系统状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 课程模型 `zhao_courses` | 已就绪 | 含 isFeatured、sort、publishDate、studentCount、enforceSequence、allowRetakeQuiz、quizRetryCount、enablePoints 等 |
| 课时模型 `zhao_course_lessons` | 已就绪 | `type` enum(video/audio/article/quiz)，`quizzes`(oneToMany→zhao-quiz.quiz)、quiz-exams 关系 |
| 播放器 `pages/video-player/video-player.vue` | 已就绪 | uni-app `<video>`，原生 controls；已有断点续播、答题弹窗、签名流式播放（buildStreamSrc）、挂起/唤醒播放时序修复 |
| 播放上下文 | 已就绪 | `uni.createVideoContext` 支持 `playbackRate()`、`requestFullScreen({direction})` |
| 课程卡片 `components/course-card/course-card.vue` | 已就绪 | 目前仅显示 免费/积分/付费 角标 |
| 列表页 `pages/index/index.vue` + `utils/course-query.ts` | 已就绪 | 已有 综合推荐/最新发布/最热/价格 排序、常驻芯片条（全部/免费/付费/精选） |
| 角色体系 zhao-auth | 已就绪 | ALL_ROLES = [admin, channel-admin, plugin-manager, instructor, user]；`GET /v1/my/roles` |
| 站点配置 zhao-common.site-config | 已就绪 | 单类型；可扩展字段 |
| 倍速/横竖屏/锁定/画中画/进度控制 | 缺失 | 待开发 |

## 3. 方案选择

### 播放控制：方案 A 自定义控制条（选定）

`<video controls="false">` 关闭原生控制条，自建控制层叠加在视频上方。

- 优点：完全可控、UI 一致、防误触锁定天然好做、倍速/画中画集中一处
- 缺点：工作量最大，需复刻进度条、手势；MP 上个别能力受限需降级隐藏
- 备选（弃用）：B 原生 controls + 浮层扩展按钮（双控制条视觉割裂、锁定盖不住原生条）；C H5 自定义 + MP 原生（两套维护成本）

### 开关粒度：默认关闭 + 课程显式开启（选定）

未配置 featureFlags 的课程保持现状，不新增任何播放功能。避免影响存量课程。

### 标记建模：新增 2 字段 + 自动新标（选定）

新增 `isTop`（置顶）、`isRecommended`（推荐）布尔字段；`isFeatured` 已有（精品）；「新」由 `publishDate` 距今天数自动推导，不存字段。

### 控制字段结构：单个 JSON featureFlags（选定）

新增 `featureFlags`（json）字段，后台 JSON 编辑器填写，后续加开关只改 key。

### 特权判定：站点配置角色名单（选定）

站点配置维护「倍速特权角色」名单，课程开特权开关后按用户角色命中判定。不新建独立 VIP 体系。

## 4. 后端数据模型

### 4.1 course content-type 新增 3 字段（`plugins/zhao-course/server/src/content-types/course/schema.json`）

```jsonc
{
  "isTop": { "type": "boolean", "default": false },        // 置顶（排序权重）
  "isRecommended": { "type": "boolean", "default": false },// 推荐（角标/筛选）
  "featureFlags": {                                        // 功能控制（开关中枢）
    "type": "json", "default": null,
    "config": { "label": "功能控制", "description": "未配置=全部关闭；JSON 对象" }
  }
}
```

### 4.2 featureFlags 结构（后台 JSON 编辑器填写）

```jsonc
{
  "playbackSpeed": true,     // 倍速播放
  "allowLandscape": true,    // 横竖屏
  "screenLock": true,        // 防误触锁定
  "autoNext": true,          // 自动连播下一课时
  "pictureInPicture": true,  // 画中画小窗
  "seekMode": "played_only", // "locked" | "played_only" | "free"，默认仅已播区域
  "vipSpeedOverride": true   // 特定角色可打破倍速限制
}
```

- featureFlags 缺失（null）/ 非对象 / 未知 key → 全部视为关闭并忽略（向前兼容）
- **seekMode 默认值规则**：
  - 课程配置了 featureFlags（启用任一功能）但未写 `seekMode` → 默认 `played_only`（仅已播区域）
  - 课程完全未配置 featureFlags（null）→ 进度保持现状（自由拖动），不影响存量课程行为
- 前端读取时统一做容错解析（parse featureFlags + 应用上述默认值规则）

### 4.3 站点配置新增特权角色名单

`plugin::zhao-common.site-config` 单类型新增 `speedPrivilegedRoles`（json 数组，默认 `["admin"]`，示例 `["admin","instructor"]`）。

### 4.4 接口

- 课程详情 / 列表返回体**确保透出 `featureFlags`、`isTop`、`isRecommended`**（实施时核对 course service 是否有字段白名单，有则补 `select`）
- 新增（或复用）公开接口 `GET /api/zhao-common/v1/site-config`，返回含 `speedPrivilegedRoles`
- 播放器进入时调用 `GET /api/zhao-auth/v1/my/roles` 获取当前用户角色
- 课时列表接口确保 populate `quizzes`（用于答题按钮显隐判定）

## 5. 播放器自定义控制条（video-player.vue）

### 5.1 控制条布局

底部悬浮条，自动隐藏（触摸唤醒），布局：

```
[▶/⏸] [进度条████████░░] [01:23/10:00]  [倍速 1.0x] [⛶横屏] [🔒锁定] [▣画中画]
```

顶部右侧：常驻「答题」按钮（仅当当前课时有关联测验时显示）。

### 5.2 各功能实现机制

| 功能 | 实现 | 平台差异 |
|---|---|---|
| 倍速 | `ctx.playbackRate(rate)`，档位 0.5/0.75/1/1.25/1.5/2x，侧向弹档位面板 | 全平台 |
| 横竖屏 | `ctx.requestFullScreen({direction:90})` / `exitFullScreen()`；H5 叠加 CSS 旋转兜底 | 全平台 |
| 防误触锁定 | 视频区全屏遮罩拦截触摸；锁定时隐藏控制条、禁用 seek/暂停 | 全平台 |
| 画中画 | H5 取原生元素 `document.getElementById(videoId)?.querySelector('video').requestPictureInPicture()`；`document.pictureInPictureEnabled` 守卫 | 仅 H5；MP 隐藏 |
| 倍速记忆 | localStorage 存 `lastPlaybackSpeed`，进课自动应用，改档即存 | 全平台 |
| 自动连播 | `onVideoEnded` 检测 `autoNext`，见 5.4 | 全平台 |

### 5.3 按钮显隐规则（由 featureFlags 驱动，全部默认隐藏）

| 开关 | 按钮 | 例外 |
|---|---|---|
| `playbackSpeed=false` | 倍速按钮隐藏 | `vipSpeedOverride=true` 且用户角色命中特权名单 → 显示（特权放行） |
| `allowLandscape=false` | 横屏按钮隐藏 | - |
| `screenLock=false` | 锁定按钮隐藏 | - |
| `pictureInPicture=false` 或非 H5 | 画中画按钮隐藏 | - |

### 5.4 答题按钮 + 自动连播优先级

**答题按钮显隐（数据驱动）**：
- 当前课时有关联测验（`lesson.quizzes?.length > 0`，由课时接口 populate）→ 播放器顶部右侧常驻「答题」按钮，播放中可随时进入答题
- 无测验 → 不显示

**自动连播优先级**：
- 课时播放结束 → 若本节**有关联测验** → **优先弹出答题弹窗**（不自动切下节）
- 若本节**无测验** → toast「已自动播放下节」并自动连播下一课时
- 已是最后一节 → 正常结束

## 6. 进度控制（seekMode）

进度条拖动策略，由 `featureFlags.seekMode` 驱动，默认 `played_only`：

| 模式 | 行为 | 实现要点 |
|---|---|---|
| `locked` 锁定 | 进度条完全不可拖，只可播放/暂停，提示「本节课进度锁定」 | 拖动事件吞掉；进度条置灰 + 小锁图标 |
| `played_only` 仅已播区域 | 只能拖回 `[0, maxPlayedTime]`，不能向前跳 | 维护 `maxPlayedTime = max(maxPlayedTime, currentTime)`；拖动目标 `clamp(≤maxPlayedTime)` |
| `free` 自由拖动 | 无限制 | 正常 seek |

**模式生效规则**（与 4.2 的默认值规则一致）：
- 课程配置了 featureFlags 且写了 `seekMode` → 按配置执行
- 课程配置了 featureFlags 但未写 `seekMode` → 按 `played_only` 执行
- 课程完全未配置 featureFlags（null）→ 视为 `free`（保持现状）

**边界细节**：
- 断点续播兼容：进入课时时 `maxPlayedTime` 初始化为恢复点，已看部分仍可拖回
- 进度条视觉：已播部分高亮；`played_only` 可拖区 = 高亮区间，未播部分显示为锁
- `locked` 模式控制条显示「进度已锁定」提示

**注**：特权只针对倍速（vipSpeedOverride），不作用于进度控制，seekMode 一律生效。

## 7. 课程列表 / 卡片标记

### 7.1 卡片角标（course-card.vue）

同显最多 2 个，优先级顺序：**精品 > 推荐 > 新**（不显示置顶角标）：

| 角标 | 触发 |
|---|---|
| 「精品」 | `isFeatured === true` |
| 「推荐」 | `isRecommended === true` |
| 「新」 | `publishDate` 距今 ≤ 30 天（自动推导） |

### 7.2 排序（course-query.ts SORT_MAP）

- 综合推荐（默认）改为：`isTop:desc, sort:asc, publishDate:asc`（**去掉 isFeatured 权重**，置顶进入权重）
- 最新发布：`publishDate:desc`（回退 `createdAt:desc`）不变
- 其余排序不变

### 7.3 筛选 chips（index.vue）

常驻芯片条新增/调整：**全部 / 免费 / 付费 / 精选 / 推荐 / 最新**（去掉置顶、增加最新）。

- 精选 / 推荐：按 `isFeatured` / `isRecommended` 字段过滤（筛选 chip 沿用现有「精选」文案，卡片角标场景同一字段显示为「精品」）
- 最新：按最新发布排序（等价「最新发布」排序）

## 8. 错误处理 / 能力降级 / 测试

- **平台降级**：MP 端隐藏画中画按钮；横屏 `requestFullScreen({direction:90})`；倍速 `ctx.playbackRate()`；H5 画中画需 `document.pictureInPictureEnabled` 守卫，不支持则隐藏按钮
- **特权判定失败**（未登录/角色不符）→ 倍速按钮隐藏，不报错不阻塞
- **签名过期**：沿用现有 `@error` 防抖换签机制
- **测试**：
  - 后端：schema 变更迁移（migration-runner）生成 + 接口字段透出验证；构建 dist 后 `Select-String` 核对
  - 前端：H5 逐功能验证（倍速/横屏/锁定/画中画/三种进度模式/连播/答题按钮显隐/特权判定）；MP 编译验证

## 9. 影响范围

| 仓库 | 文件 | 变更 |
|---|---|---|
| strapi | `plugins/zhao-course/server/src/content-types/course/schema.json` | +isTop/+isRecommended/+featureFlags |
| strapi | `plugins/zhao-common/...site-config` schema | +speedPrivilegedRoles |
| strapi | course service / controller（如需） | 字段透出 |
| strapi | zhao-common site-config 接口（如需） | 公开读取 |
| strapi-course | `pages/video-player/video-player.vue` | 自定义控制条 + 全部播放控制 |
| strapi-course | `services/api.ts` | Course 类型扩展、site-config/roles 获取、buildStreamSrc 不变 |
| strapi-course | `components/course-card/course-card.vue` | 精品/推荐/新 角标 |
| strapi-course | `utils/course-query.ts` | 综合推荐排序、筛选参数 |
| strapi-course | `pages/index/index.vue` | 筛选 chips、角标数据 |

## 10. 部署注意（沿用铁律）

- 后端 schema 变更 → 本地构建 dist → 提交 → 服务器 `git pull` + `pm2 restart`（**绝不在服务器构建**）
- C端 → HBuilder X 手动编译运行
