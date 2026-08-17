# 课程播放控制与展示标记增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为课程增加播放控制（倍速/横竖屏/防误触锁定/画中画/自动连播/进度控制）与展示标记（精品/推荐/新），并支持特定角色打破倍速限制。

**Architecture:** 课程新增单个 `featureFlags`（json）字段作为"功能开关中枢"，未配置=全部关闭（向后兼容存量课程）；站点配置新增倍速特权角色名单。前端用自定义控制条替换原生 `<video controls>`，由 featureFlags 驱动按钮显隐与进度模式（seekMode：locked/played_only/free）。列表端新增 `isTop`/`isRecommended` 字段，调整综合推荐排序与筛选芯片。

**Tech Stack:** Strapi v5（zhao-course / zhao-common 插件，TS + migration-runner）、uni-app（Vue3 `<script setup>`、`uni.createVideoContext`）、SCSS。

**关联设计文档:** `docs/superpowers/specs/2026-08-17-course-playback-controls-design.md`（已批准）

---

## 文件结构

**后端（`d:\zhao\strapi`）：**
| 文件 | 责任 |
|---|---|
| `plugins/zhao-course/server/src/content-types/course/schema.json` | +isTop / +isRecommended / +featureFlags |
| `plugins/zhao-common/server/src/content-types/site-config/schema.json` | +speedPrivilegedRoles |
| `plugins/zhao-common/server/src/services/config.ts` | 公开配置透出 speedPrivilegedRoles |

课程 service（course.ts）与课时 service（course-lesson.ts）均已全字段透出且支持外部传入 populate，**无需改代码**，仅验证。

**前端（`d:\zhao\strapi-course`）：**
| 文件 | 责任 |
|---|---|
| `utils/player-features.ts`（新建） | featureFlags 容错解析 + seekMode 默认值 + 倍速特权判定 + 倍速记忆 |
| `services/api.ts` | Course/Lesson 类型扩展、getLessonList populate quizzes、getMyRoles、getSitePublicConfig |
| `pages/video-player/video-player.vue` | 自定义控制条（倍速/横竖屏/锁定/画中画/连播/进度控制） |
| `utils/course-query.ts` | 综合推荐排序、筛选类型与映射 |
| `components/course-card/course-card.vue` | 精品/推荐/新 角标 |
| `pages/index/index.vue` | 「最新」芯片 → 最新发布排序联动 |

> 部署铁律：后端本地构建 dist 后提交 git，服务器仅 `git pull` + `pm2 restart`，绝不在服务器构建。

---

## Phase A：后端（strapi 仓库）

### Task A1: course content-type 新增 3 字段

**Files:**
- Modify: `d:\zhao\strapi\plugins\zhao-course\server\src\content-types\course\schema.json`

- [ ] **Step 1: 在 `isFeatured` 字段后插入 3 个新字段**

在 [schema.json](file:///d:/zhao/strapi/plugins/zhao-course/server/src/content-types/course/schema.json) 的 `"isFeatured"` 块（约 71-74 行）之后插入：

```json
    "isTop": {
      "type": "boolean",
      "default": false
    },
    "isRecommended": {
      "type": "boolean",
      "default": false
    },
    "featureFlags": {
      "type": "json",
      "default": null
    },
```

- [ ] **Step 2: 校验 JSON 合法**

用编辑器/`node -e "JSON.parse(require('fs').readFileSync('plugins/zhao-course/server/src/content-types/course/schema.json','utf8'))"` 确认无语法错误。

> 说明：新增布尔字段（默认 false）与 json 字段（默认 null）由 Strapi v5 启动时自动同步 schema 建列，无需写数据迁移（migration-runner 仅用于数据回填，此处无回填数据）。

- [ ] **Step 3: Commit**

```bash
git add plugins/zhao-course/server/src/content-types/course/schema.json
git commit -m "feat(zhao-course): course 新增 isTop/isRecommended/featureFlags 字段"
```

---

### Task A2: site-config 新增倍速特权角色名单 + 公开配置透出

**Files:**
- Modify: `d:\zhao\strapi\plugins\zhao-common\server\src\content-types\site-config\schema.json`
- Modify: `d:\zhao\strapi\plugins\zhao-common\server\src\services\config.ts`

- [ ] **Step 1: site-config schema 新增字段**

在 [schema.json](file:///d:/zhao/strapi/plugins/zhao-common/server/src/content-types/site-config/schema.json) 末尾（`posterDefaultRecommendReason` 之后）追加：

```json
    "speedPrivilegedRoles": {
      "type": "json",
      "default": ["admin"],
      "description": "倍速特权角色名单（如 [\"admin\",\"instructor\"]），命中可打破课程倍速限制"
    }
```

- [ ] **Step 2: 公开配置透出 speedPrivilegedRoles**

在 [config.ts](file:///d:/zhao/strapi/plugins/zhao-common/server/src/services/config.ts) 的 `getPublicConfig` 中，将 `"speedPrivilegedRoles"` 加入两处：

1. 空配置兜底分支（约 258-298 行）的 `site` 对象，追加：
```ts
            speedPrivilegedRoles: ["admin"],
```
2. `PUBLIC_FIELDS` 数组（约 301-307 行）追加 `"speedPrivilegedRoles"`，`DEFAULT_CONFIG`（约 308-313 行）追加 `speedPrivilegedRoles: ["admin"]`。**注意**：`DEFAULT_CONFIG` 现声明为 `Record<string, string>`，加入数组值前必须把类型注解改为 `Record<string, any>`，否则 TS 编译报错：

```ts
      const PUBLIC_FIELDS = [
        "siteName", "siteDescription", "seoKeywords", "seoDescription",
        "tencentMapKey", "shareTitle", "shareDescription", "icpNumber",
        "customerServiceUrl", "domain",
        "posterDefaultUserName", "posterDefaultRecommendReason",
        "speedPrivilegedRoles",
      ];
      // 类型必须从 Record<string, string> 改为 Record<string, any>（含数组默认值）
      const DEFAULT_CONFIG: Record<string, any> = {
        siteName: "", siteDescription: "", seoKeywords: "", seoDescription: "",
        tencentMapKey: "", shareTitle: "", shareDescription: "", icpNumber: "",
        customerServiceUrl: "", domain: "",
        posterDefaultUserName: "", posterDefaultRecommendReason: "",
        speedPrivilegedRoles: ["admin"],
      };
```

> 前端通过现有 `GET /api/zhao-common/v1/public/config`（`config.getPublic`，公开路由）读取，无需新增接口。前端 auth-config 的 `site` 子对象自动带上该字段。

- [ ] **Step 3: 校验 JSON 合法 + Commit**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/zhao-common/server/src/content-types/site-config/schema.json','utf8'))"
git add plugins/zhao-common/server/src/content-types/site-config/schema.json plugins/zhao-common/server/src/services/config.ts
git commit -m "feat(zhao-common): site-config 新增 speedPrivilegedRoles 并公开透出"
```

---

### Task A3: 后端字段透出核对（课程 / 课时）

**Files:**
- Verify only：`d:\zhao\strapi\plugins\zhao-course\server\src\services\course.ts`、`course-lesson.ts`

- [ ] **Step 1: 核对课程接口不设字段白名单**

[course.ts](file:///d:/zhao/strapi/plugins/zhao-course/server/src/services/course.ts) 的 `find`/`findOne` 使用 `strapi.documents(UID).findMany/findOne` + `populate`，无 `fields` 白名单 → 新增 `isTop/isRecommended/featureFlags` 自动返回，**无需修改**。确认即可。

- [ ] **Step 2: 核对课时接口支持外部 populate quizzes**

[course-lesson.ts](file:///d:/zhao/strapi/plugins/zhao-course/server/src/services/course-lesson.ts) 的 `find` 中 `populate: { ..., ...(populate || {}) }` → 前端传 `populate[quizzes]=true` 即可返回课时关联测验，**无需修改**。确认即可。

> 无代码变更，跳过 commit。

---

### Task A4: 后端本地构建 + dist 核对 + 提交

**Files:**
- Build output: `d:\zhao\strapi\dist`（及插件 dist）

- [ ] **Step 1: 本地构建**

在 `d:\zhao\strapi` 执行：

```bash
npm run build
```

Expected: 构建成功、退出码 0。

- [ ] **Step 2: dist 产物核对新字段**

在 `d:\zhao\strapi` 执行（PowerShell）：

```powershell
Get-ChildItem -Recurse -Path dist, plugins\zhao-course\dist, plugins\zhao-common\dist -Filter *.js -ErrorAction SilentlyContinue | Select-String -Pattern "isTop|featureFlags|speedPrivilegedRoles" | Select-Object -First 20
```

Expected: 能匹配到新字段名（证明编译产物包含本次变更）。

- [ ] **Step 3: 提交构建产物**

```bash
git add dist plugins/zhao-course/dist plugins/zhao-common/dist
git commit -m "build: 重新构建后端 dist（含课程播放控制字段）"
```

> 部署：服务器 `git pull` + `pm2 restart`（本阶段完成后执行，或与 Phase C 合并一次部署）。

---

## Phase B：前端（strapi-course 仓库）

### Task B1: services/api.ts — 类型扩展与接口

**Files:**
- Modify: `d:\zhao\strapi-course\services\api.ts`

- [ ] **Step 1: 引入 SITE_DOMAIN**

在 [api.ts](file:///d:/zhao/strapi-course/services/api.ts) 顶部 import 中加入 `SITE_DOMAIN`：

```ts
import { BASE_API, SITE_DOMAIN } from '../utils/env'
```

- [ ] **Step 2: Course / Lesson 类型扩展**

在 `Course` 接口（约 677-712 行）的 `isFeatured?` 之后追加：

```ts
  isTop?: boolean
  isRecommended?: boolean
  featureFlags?: Record<string, any> | null
```

在 `Lesson` 接口（约 714-727 行）追加：

```ts
  // 关联测验（用于答题按钮/自动连播判定）
  quizzes?: Array<{ documentId: string; title?: string }>
```

- [ ] **Step 3: getLessonList 增加 quizzes populate**

将 `getLessonList`（约 344-349 行）改为：

```ts
export async function getLessonList(courseId: string) {
  const params = new URLSearchParams()
  params.append('filters[course][documentId][$eq]', courseId)
  params.append('sort', 'sequenceNumber:asc')
  params.append('populate[quizzes]', 'true')
  return request(`/zhao-course/v1/course-lessons?${params.toString()}`)
}
```

- [ ] **Step 4: 新增 getMyRoles / getSitePublicConfig**

在 api.ts 的"用户相关 API"区（约 636-674 行）追加：

```ts
/** 获取当前用户角色名列表（如 ['admin','instructor']），未登录返回 [] */
export async function getMyRoles(): Promise<string[]> {
  try {
    const res = await request('/zhao-auth/v1/my/roles')
    const roles = res?.roles || []
    return Array.isArray(roles) ? roles.map((r: any) => r?.name).filter(Boolean) : []
  } catch (e) {
    console.warn('获取角色失败（按无特权处理）', e)
    return []
  }
}

/** 获取站点公开配置（含倍速特权角色名单 speedPrivilegedRoles） */
export async function getSitePublicConfig(): Promise<any> {
  try {
    const res = await request(`/zhao-common/v1/public/config?domain=${encodeURIComponent(SITE_DOMAIN)}`)
    return res?.data ?? res
  } catch (e) {
    console.warn('获取站点公开配置失败', e)
    return null
  }
}
```

> 注意：`/zhao-auth/v1/my/roles` 非公开路由，未登录时 `request` 抛错被捕获 → 返回 `[]`，不阻塞播放器。

- [ ] **Step 5: Commit**

```bash
git add services/api.ts
git commit -m "feat(api): 扩展课程/课时类型，新增角色与站点配置接口"
```

---

### Task B2: utils/player-features.ts — 功能开关中枢解析（新建）

**Files:**
- Create: `d:\zhao\strapi-course\utils\player-features.ts`

- [ ] **Step 1: 写入完整工具模块**

```ts
// strapi-course/utils/player-features.ts
// 课程播放功能开关（featureFlags）容错解析、seekMode 默认值、倍速特权判定、倍速记忆

export type SeekMode = 'locked' | 'played_only' | 'free'

export interface CourseFeatureFlags {
  /** 课程是否配置了 featureFlags（null/非对象=未配置，用于默认值规则区分） */
  configured: boolean
  playbackSpeed: boolean
  allowLandscape: boolean
  screenLock: boolean
  autoNext: boolean
  pictureInPicture: boolean
  vipSpeedOverride: boolean
  seekMode: SeekMode
}

export const DEFAULT_SEEK_MODE: SeekMode = 'played_only'
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

const SPEED_STORAGE_KEY = 'lastPlaybackSpeed'

/**
 * 解析课程 featureFlags（json 字段）
 * 默认值规则：
 * - featureFlags 为 null / 非对象 / 未知 key → 全部关闭，configured=false
 * - configured=true 但未写 seekMode → 默认 played_only
 * - configured=false → seekMode 视为 free（保持现状，向后兼容存量课程）
 */
export function parseCourseFeatureFlags(raw: unknown): CourseFeatureFlags {
  const isObject = !!raw && typeof raw === 'object' && !Array.isArray(raw)
  const ff = isObject ? (raw as Record<string, any>) : {}
  const configured = isObject
  return {
    configured,
    playbackSpeed: ff.playbackSpeed === true,
    allowLandscape: ff.allowLandscape === true,
    screenLock: ff.screenLock === true,
    autoNext: ff.autoNext === true,
    pictureInPicture: ff.pictureInPicture === true,
    vipSpeedOverride: ff.vipSpeedOverride === true,
    seekMode: configured
      ? (ff.seekMode === 'locked' || ff.seekMode === 'free' || ff.seekMode === 'played_only'
        ? (ff.seekMode as SeekMode)
        : DEFAULT_SEEK_MODE)
      : 'free',
  }
}

/** 是否允许显示倍速按钮：开关开启，或课程开启特权且用户命中特权角色名单 */
export function isSpeedEnabled(
  flags: CourseFeatureFlags,
  userRoles: string[],
  speedPrivilegedRoles: string[]
): boolean {
  if (flags.playbackSpeed) return true
  if (!flags.vipSpeedOverride) return false
  const roles = Array.isArray(userRoles) ? userRoles : []
  if (roles.length === 0) return false
  const privileged = Array.isArray(speedPrivilegedRoles) ? speedPrivilegedRoles : []
  return roles.some((r) => privileged.includes(r))
}

/** 读取记忆的倍速（本地存储），非法值回退 1x */
export function getSavedSpeed(): number {
  try {
    const v = Number(uni.getStorageSync(SPEED_STORAGE_KEY))
    return SPEED_OPTIONS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

/** 保存倍速档位（倍速记忆） */
export function saveSpeed(rate: number): void {
  try {
    uni.setStorageSync(SPEED_STORAGE_KEY, rate)
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/player-features.ts
git commit -m "feat(player-features): featureFlags 解析/seekMode 默认值/倍速特权判定"
```

---

### Task B3: video-player.vue — 自定义控制条（模板 + 样式）

**Files:**
- Modify: `d:\zhao\strapi-course\pages\video-player\video-player.vue`

- [ ] **Step 1: 关闭原生控件并调整 video 属性**

将视频区（13-38 行）改为：

```html
    <view class="video-player" @click="onVideoAreaTap">
      <video
        v-if="mediaUrl"
        :id="videoId"
        :src="mediaUrl"
        :poster="posterUrl"
        :initial-time="initialTime"
        :controls="false"
        :autoplay="false"
        class="video-element"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @timeupdate="onTimeUpdate"
        @ended="onVideoEnded"
        @loadedmetadata="onLoadedMetadata"
        @fullscreenchange="onFullscreenChange"
        @error="onMediaSourceError"
      />
      <view v-else class="video-placeholder">
        <text class="play-icon">▶</text>
        <text class="placeholder-text">暂无音视频内容</text>
      </view>

      <!-- 防误触锁定遮罩（锁定时拦截触摸，仅保留解锁入口） -->
      <view v-if="isLocked && mediaUrl" class="lock-overlay" @click.stop>
        <text class="lock-unlock-btn" @click.stop="toggleLock">🔓</text>
      </view>

      <!-- 常驻答题按钮（课时有关联测验时显示） -->
      <view
        v-if="hasQuiz && !isLocked && mediaUrl"
        class="answer-float-btn"
        @click.stop="startQuiz"
      >
        <text>📝 答题</text>
      </view>

      <!-- 自定义控制条 -->
      <view v-if="showControls && !isLocked && mediaUrl" class="custom-controls" @click.stop>
        <view class="controls-row">
          <text class="ctrl-btn" @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</text>
          <view
            class="progress-wrap"
            @touchstart.stop="onProgressTouchStart"
            @touchmove.stop="onProgressTouchMove"
            @touchend.stop="onProgressTouchEnd"
          >
            <view class="progress-track">
              <view class="progress-played" :style="{ width: progressBarWidth }"></view>
              <view v-if="seekMode === 'played_only'" class="progress-locked" :style="{ left: progressBarWidth }"></view>
              <view class="progress-thumb" :style="{ left: progressBarWidth }"></view>
            </view>
          </view>
          <text class="time-text">{{ formatTime(currentTime) }}/{{ formatTime(duration) }}</text>
          <text v-if="showSpeedBtn" class="ctrl-btn" @click="toggleSpeedPanel">{{ currentSpeed }}x</text>
          <text v-if="showLandscapeBtn" class="ctrl-btn" @click="toggleLandscape">{{ isFullscreen ? '⛶退出' : '⛶' }}</text>
          <text v-if="showLockBtn" class="ctrl-btn" @click="toggleLock">🔒</text>
          <text v-if="showPiPBtn" class="ctrl-btn" @click="togglePiP">▣</text>
        </view>

        <!-- 倍速面板 -->
        <view v-if="showSpeedPanel" class="speed-panel">
          <text
            v-for="r in SPEED_OPTIONS"
            :key="r"
            :class="['speed-option', { active: currentSpeed === r }]"
            @click="applySpeed(r)"
          >{{ r }}x</text>
        </view>

        <!-- 进度锁定提示 -->
        <text v-if="seekMode === 'locked'" class="seek-locked-tip">🔒 本节课进度锁定</text>
      </view>
    </view>
```

- [ ] **Step 2: 追加控制条样式**

在 [video-player.vue](file:///d:/zhao/strapi-course/pages/video-player/video-player.vue) 的 `<style>` 末尾追加：

```scss
/* ===== 自定义控制条 ===== */
.video-player {
  position: relative;
}

.custom-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0));
  padding: 40rpx 20rpx 20rpx;
  z-index: 20;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.ctrl-btn {
  color: #fff;
  font-size: 32rpx;
  padding: 10rpx 6rpx;
  flex-shrink: 0;
}

.time-text {
  color: rgba(255,255,255,0.9);
  font-size: 22rpx;
  white-space: nowrap;
  flex-shrink: 0;
}

.progress-wrap {
  flex: 1;
  padding: 10rpx 0;
  touch-action: none;
}

.progress-track {
  position: relative;
  height: 8rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 4rpx;
}

.progress-played {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #667eea;
  border-radius: 4rpx;
}

.progress-locked {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  background: rgba(255,255,255,0.15);
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
}

.speed-panel {
  position: absolute;
  bottom: 110rpx;
  right: 20rpx;
  background: rgba(0,0,0,0.85);
  border-radius: 16rpx;
  padding: 12rpx 0;
  display: flex;
  flex-direction: column;
  z-index: 30;
}

.speed-option {
  padding: 16rpx 40rpx;
  color: rgba(255,255,255,0.85);
  font-size: 26rpx;

  &.active {
    color: #667eea;
    font-weight: bold;
  }
}

.seek-locked-tip {
  display: block;
  margin-top: 10rpx;
  color: rgba(255,255,255,0.85);
  font-size: 22rpx;
  text-align: center;
}

/* 防误触锁定遮罩 */
.lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.35);
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-unlock-btn {
  color: #fff;
  font-size: 60rpx;
  background: rgba(0,0,0,0.4);
  border-radius: 50%;
  width: 110rpx;
  height: 110rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 常驻答题按钮 */
.answer-float-btn {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  z-index: 16;
  background: rgba(102,126,234,0.9);
  color: #fff;
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;

  text {
    color: #fff;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add pages/video-player/video-player.vue
git commit -m "feat(video-player): 自定义控制条模板与样式"
```

> 注意：此任务仅加模板/样式，脚本逻辑在 B4 补齐。B4 未完成前页面会因未定义变量编译报错，故 B3/B4 应在同一工作区间连续完成，先提交无妨（B4 紧随其后）。

---

### Task B4: video-player.vue — 播放控制逻辑（脚本）

**Files:**
- Modify: `d:\zhao\strapi-course\pages\video-player\video-player.vue`

- [ ] **Step 1: 引入工具与类型**

在 [video-player.vue](file:///d:/zhao/strapi-course/pages/video-player/video-player.vue) 的 import 区追加：

```ts
import {
  parseCourseFeatureFlags,
  isSpeedEnabled,
  getSavedSpeed,
  saveSpeed,
  SPEED_OPTIONS,
  type CourseFeatureFlags,
} from '../../utils/player-features'
import { getMyRoles, getSitePublicConfig } from '../../services/api'
```

- [ ] **Step 2: 追加状态与计算属性**

在 `// 视频播放器相关`（约 302-306 行）附近追加：

```ts
// ===== 播放控制（featureFlags 驱动）=====
const ff = ref<CourseFeatureFlags>({ configured: false, playbackSpeed: false, allowLandscape: false, screenLock: false, autoNext: false, pictureInPicture: false, vipSpeedOverride: false, seekMode: 'free' })
const userRoles = ref<string[]>([])
const speedPrivilegedRoles = ref<string[]>(['admin'])
const showControls = ref(true)
const isLocked = ref(false)
const isFullscreen = ref(false)
const showSpeedPanel = ref(false)
const currentSpeed = ref(getSavedSpeed())
const maxPlayedTime = ref(0)
let controlsHideTimer: number | null = null
let dragging = false
let dragTarget = 0
let progressRect = { left: 0, width: 0 }

// #ifdef H5
const isH5 = true
// #endif
// #ifndef H5
const isH5 = false
// #endif

const hasQuiz = computed(() => (currentLesson.value?.quizzes?.length ?? 0) > 0)
const showSpeedBtn = computed(() => isSpeedEnabled(ff.value, userRoles.value, speedPrivilegedRoles.value))
const showLandscapeBtn = computed(() => ff.value.allowLandscape)
const showLockBtn = computed(() => ff.value.screenLock)
const showPiPBtn = computed(
  () => ff.value.pictureInPicture && isH5 && typeof document !== 'undefined' && !!document.pictureInPictureEnabled
)
const seekMode = computed(() => ff.value.seekMode)
const progressBarWidth = computed(() =>
  duration.value > 0 ? `${(Math.min(currentTime.value, duration.value) / duration.value) * 100}%` : '0%'
)
```

- [ ] **Step 3: 加载配置（featureFlags / 角色 / 特权名单）**

在 `loadData` 中 `courseDetail.value = courseRes || null`（约 391 行）之后追加：

```ts
    // 解析课程播放功能开关（未配置=全部关闭）
    ff.value = parseCourseFeatureFlags((courseRes as any)?.featureFlags)
    // 注：maxPlayedTime 在此处不初始化——lessons 尚未赋值（411 行），
    // 统一由 offerLessonPlayback 内的 resetPlaybackState 初始化（见 Step 4）

    // 非阻塞加载：倍速特权角色名单 + 当前用户角色（失败静默，按无特权处理）
    getSitePublicConfig().then((cfg: any) => {
      const list = cfg?.site?.speedPrivilegedRoles
      if (Array.isArray(list)) speedPrivilegedRoles.value = list
    })
    getMyRoles().then((roles) => { userRoles.value = roles })
```

- [ ] **Step 4: 课时切换时重置播放状态**

新增函数，并在 **`offerLessonPlayback` 开头**（`const lesson = lessons.value[index]` / `if (!lesson) return` 之后）调用一次：

```ts
/** 切换课时时重置播放控制状态（只在 offerLessonPlayback 内调用：
 * 它覆盖 loadData 初次加载(419行)与所有切换路径(selectLesson/handleSwitchLesson/handleLockGoto/handleLockSkip)，
 * 且调用时 currentLessonIndex 已更新，能读到正确的 playPosition） */
function resetPlaybackState() {
  isLocked.value = false
  showSpeedPanel.value = false
  showControls.value = true
  dragging = false
  maxPlayedTime.value = currentLesson.value?.playPosition || 0
  if (controlsHideTimer) clearTimeout(controlsHideTimer)
}
```

> 不要在 `selectLesson`/`handleSwitchLesson` 开头调用 `resetPlaybackState()`——那两处 `currentLessonIndex` 尚未更新，会读到**旧课时**的 playPosition。

- [ ] **Step 5: 播放/暂停与控制条显隐**

新增函数：

```ts
function togglePlay() {
  const ctx = getVideoContext()
  if (!ctx) return
  if (isPlaying.value) ctx.pause()
  else ctx.play()
  showControlsTemporarily()
}

function onVideoAreaTap() {
  if (isLocked.value) return
  showControls.value = !showControls.value
  if (showControls.value) showControlsTemporarily()
}

function showControlsTemporarily() {
  showControls.value = true
  restartControlsTimer()
}

function restartControlsTimer() {
  if (controlsHideTimer) clearTimeout(controlsHideTimer)
  controlsHideTimer = setTimeout(() => {
    if (!isLocked.value) showControls.value = false
  }, 3000)
}
```

- [ ] **Step 6: 倍速播放（含记忆与特权放行）**

新增函数：

```ts
function toggleSpeedPanel() {
  showSpeedPanel.value = !showSpeedPanel.value
  restartControlsTimer()
}

function applySpeed(rate: number) {
  currentSpeed.value = rate
  showSpeedPanel.value = false
  saveSpeed(rate)
  applyPlaybackRate()
  restartControlsTimer()
}

/** 应用倍速：无权限时强制 1x（防止记忆的倍速被应用到无权限课程） */
function applyPlaybackRate() {
  const ctx = getVideoContext()
  if (!ctx) return
  try {
    ctx.playbackRate(showSpeedBtn.value ? currentSpeed.value : 1)
  } catch {}
}
```

在 `onLoadedMetadata`（约 722-734 行）中追加 `applyPlaybackRate()`（放在 seek 之后）；在 `playLessonFrom` 的 `nextTick` 内 `ctx.play()` 之后追加 `applyPlaybackRate()`。

- [ ] **Step 7: 横竖屏**

新增函数：

```ts
function toggleLandscape() {
  const ctx = getVideoContext()
  if (!ctx) return
  if (isFullscreen.value) ctx.exitFullScreen()
  else ctx.requestFullScreen({ direction: 90 })
}

function onFullscreenChange(e: any) {
  isFullscreen.value = !!e?.detail?.fullScreen
}
```

- [ ] **Step 8: 防误触锁定**

新增函数：

```ts
function toggleLock() {
  isLocked.value = !isLocked.value
  if (isLocked.value) {
    showControls.value = false
    showSpeedPanel.value = false
  } else {
    showControlsTemporarily()
  }
}
```

- [ ] **Step 9: 画中画（仅 H5）**

新增函数：

```ts
async function togglePiP() {
  if (!isH5) return
  const el = (document as any).getElementById(videoId)?.querySelector('video')
  if (!el || !(document as any).pictureInPictureEnabled) {
    uni.showToast({ title: '当前环境不支持画中画', icon: 'none' })
    return
  }
  try {
    if ((document as any).pictureInPictureElement) {
      await (document as any).exitPictureInPicture()
    } else {
      await el.requestPictureInPicture()
    }
  } catch (e) {
    uni.showToast({ title: '画中画不可用', icon: 'none' })
  }
}
```

- [ ] **Step 10: 进度控制（seekMode）**

新增函数：

```ts
/** 获取进度条容器尺寸（跨平台：H5/MP 均可用） */
function getProgressRect(): Promise<{ left: number; width: number }> {
  return new Promise((resolve) => {
    uni.createSelectorQuery()
      .select('.progress-wrap')
      .boundingClientRect((rect: any) => resolve(rect || { left: 0, width: 0 }))
      .exec()
  })
}

function clientX(e: any): number {
  return e?.touches?.[0]?.clientX ?? e?.changedTouches?.[0]?.clientX ?? 0
}

async function onProgressTouchStart(e: any) {
  if (isLocked.value) return
  if (seekMode.value === 'locked') {
    uni.showToast({ title: '本节课进度锁定', icon: 'none' })
    return
  }
  progressRect = await getProgressRect()
  dragging = true
  dragTarget = progressToTime(clientX(e))
}

function onProgressTouchMove(e: any) {
  if (!dragging) return
  dragTarget = progressToTime(clientX(e))
}

function onProgressTouchEnd() {
  if (!dragging) return
  dragging = false
  handleSeek(dragTarget)
}

function progressToTime(x: number): number {
  const { left, width } = progressRect
  if (!width) return 0
  const ratio = Math.max(0, Math.min(1, (x - left) / width))
  return ratio * (duration.value || 0)
}

/** 按 seekMode 执行 seek：locked=禁拖 / played_only=clamp(≤maxPlayedTime) / free=自由 */
function handleSeek(target: number) {
  const dur = duration.value
  if (dur <= 0) return
  const mode = seekMode.value
  if (mode === 'locked') {
    uni.showToast({ title: '本节课进度锁定', icon: 'none' })
    return
  }
  let t = Math.max(0, Math.min(target, dur))
  if (mode === 'played_only') {
    t = Math.min(t, maxPlayedTime.value)
  }
  const ctx = getVideoContext()
  if (ctx) ctx.seek(t)
  currentTime.value = t
  progress.value = dur > 0 ? (t / dur) * 100 : 0
}
```

在 `onTimeUpdate`（约 696-711 行）中追加更新 `maxPlayedTime`：

```ts
  // 维护最大已播时长（供 played_only 模式限制拖回上限；断点续播已初始化到恢复点）
  if (curTime > maxPlayedTime.value) maxPlayedTime.value = curTime
```

- [ ] **Step 11: 自动连播 + 答题按钮联动**

将 `markLessonComplete`（约 775-793 行）中"弹出去答题提示"部分改为（自动连播且无测验时不再弹完成弹窗，交给 onVideoEnded 连播）：

```ts
    // 自动连播（autoNext && 无测验 && 非末节）时不再弹完成弹窗，直接连播
    const autoSkip = ff.value.autoNext && !hasQuiz.value && currentLessonIndex.value < lessons.value.length - 1
    if (!autoSkip) {
      resumeMode.value = 'completed'
      showResumeDialog.value = true
      resumeShownSet.value.add(lesson.documentId)
    }
```

将 `onVideoEnded`（约 713-720 行）改为：

```ts
function onVideoEnded() {
  isPlaying.value = false
  stopProgressSaveTimer()
  if (!hasMarkedComplete) {
    markLessonComplete()
  }
  saveLearningProgress()
  // 自动连播：开了 autoNext 且本节无测验且非末节 → toast + 播下一节
  if (ff.value.autoNext && !hasQuiz.value && currentLessonIndex.value < lessons.value.length - 1) {
    uni.showToast({ title: '已自动播放下节', icon: 'none' })
    goToNext()
  }
}
```

- [ ] **Step 12: 清理计时器**

在 `onUnmounted`（约 1082-1086 行）中追加：

```ts
  if (controlsHideTimer) clearTimeout(controlsHideTimer)
```

- [ ] **Step 13: Commit**

```bash
git add pages/video-player/video-player.vue
git commit -m "feat(video-player): 倍速/横竖屏/锁定/画中画/连播/进度控制"
```

---

### Task B5: utils/course-query.ts — 排序与筛选

**Files:**
- Modify: `d:\zhao\strapi-course\utils\course-query.ts`

- [ ] **Step 1: 综合推荐排序改为置顶优先**

将 `SORT_MAP.default`（约 31 行）改为：

```ts
  default: 'isTop:desc,sort:asc,publishDate:asc,createdAt:asc',
```

（去掉 isFeatured 权重，置顶进入排序首位。）

- [ ] **Step 2: 扩展 PriceType 与筛选选项**

将 `PriceType`（约 8 行）改为：

```ts
export type PriceType = 'all' | 'free' | 'points' | 'paid' | 'featured' | 'recommended' | 'newest'
```

将 `PRICE_TYPE_OPTIONS`（约 61-67 行）改为：

```ts
export const PRICE_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'free', label: '免费' },
  { value: 'paid', label: '付费' },
  { value: 'featured', label: '⭐精选' },
  { value: 'recommended', label: '🔥推荐' },
  { value: 'newest', label: '✨最新' }
]
```

> 注：按已批准设计，常驻芯片为「全部/免费/付费/精选/推荐/最新」，积分筛选不再作为常驻芯片（积分课仍可走弹层 courseType 筛选）。若需保留积分芯片请在此处加回 `{ value: 'points', label: '积分' }`。

- [ ] **Step 3: buildCourseQuery 增加 recommended 过滤**

在 `buildCourseQuery` 的价格类型分支（约 124-133 行）改为：

```ts
  // 价格类型（free/points/paid 映射到 courseType，featured→isFeatured，recommended→isRecommended）
  if (params.priceType && params.priceType !== 'all') {
    if (params.priceType === 'featured') {
      query[`filters[$and][${andIndex}][isFeatured][$eq]`] = 'true'
      andIndex++
    } else if (params.priceType === 'recommended') {
      query[`filters[$and][${andIndex}][isRecommended][$eq]`] = 'true'
      andIndex++
    } else if (params.priceType === 'newest') {
      // 最新 = 按最新发布排序（由调用方把 sort 设为 newest），无字段过滤
    } else {
      // free/points/paid 都映射到 courseType
      query[`filters[$and][${andIndex}][courseType][$eq]`] = params.priceType
      andIndex++
    }
  }
```

- [ ] **Step 4: parseUrlQuery 白名单同步**

将 `parseUrlQuery` 中 priceType 白名单（约 240 行）改为：

```ts
  if (priceType && ['all', 'free', 'points', 'paid', 'featured', 'recommended', 'newest'].includes(priceType)) {
```

- [ ] **Step 5: Commit**

```bash
git add utils/course-query.ts
git commit -m "feat(course-query): 置顶排序/推荐与最新筛选"
```

---

### Task B6: pages/index/index.vue — 「最新」芯片联动

**Files:**
- Modify: `d:\zhao\strapi-course\pages\index\index.vue`

- [ ] **Step 1: loadCourses 中「最新」芯片 → 最新发布排序**

将 `loadCourses`（约 417-442 行）中的 `getCourseList` 调用改为：

```ts
    const effectiveSort = priceType.value === 'newest' ? 'newest' : sortKey.value
    const effectivePriceType = priceType.value === 'newest' ? 'all' : priceType.value
    const res: any = await getCourseList({
      category: activeCategory.value,
      q: searchKeyword.value,
      sort: effectiveSort,
      priceType: effectivePriceType,
      difficulty: filterState.value.difficulty,
      language: filterState.value.language,
      minPrice: filterState.value.priceRange[0],
      maxPrice: filterState.value.priceRange[1],
      tags: filterState.value.tags
    })
```

- [ ] **Step 2: Commit**

```bash
git add pages/index/index.vue
git commit -m "feat(index): 最新芯片联动最新发布排序"
```

---

### Task B7: course-card.vue — 精品/推荐/新 角标

**Files:**
- Modify: `d:\zhao\strapi-course\components\course-card\course-card.vue`

- [ ] **Step 1: 模板添加角标区**

在封面区（[course-card.vue](file:///d:/zhao/strapi-course/components/course-card/course-card.vue) 的 7-28 行）的 `points-badge` 之后追加：

```html
      <!-- 课程标记角标（精品/推荐/新，最多 2 个） -->
      <view v-if="badges.length > 0" class="course-tags">
        <text v-for="b in badges" :key="b.text" :class="b.cls">{{ b.text }}</text>
      </view>
```

- [ ] **Step 2: 脚本添加角标计算**

在 `<script setup>`（约 54-90 行）中追加：

```ts
/** 发布距今 ≤ 30 天视为「新」（自动推导，不存字段） */
const isNew = computed(() => {
  const pub = props.course.publishDate
  if (!pub) return false
  const diff = Date.now() - new Date(pub).getTime()
  return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000
})

/** 角标列表（优先级：精品 > 推荐 > 新，同显最多 2 个） */
const badges = computed<Array<{ text: string; cls: string }>>(() => {
  const list: Array<{ text: string; cls: string }> = []
  if (props.course.isFeatured) list.push({ text: '精品', cls: 'badge-tag badge-featured' })
  if (props.course.isRecommended) list.push({ text: '推荐', cls: 'badge-tag badge-recommended' })
  if (isNew.value) list.push({ text: '新', cls: 'badge-tag badge-new' })
  return list.slice(0, 2)
})
```

- [ ] **Step 3: 样式追加**

在 `<style>` 末尾追加：

```scss
/* 课程标记角标 */
.course-tags {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.badge-tag {
  padding: 2rpx 10rpx;
  font-size: 20rpx;
  border-radius: 6rpx;
  color: #fff;
}

.badge-featured {
  background: linear-gradient(135deg, #f5222d 0%, #ff7a45 100%);
}

.badge-recommended {
  background: linear-gradient(135deg, #ff9800 0%, #ffc53d 100%);
}

.badge-new {
  background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
}
```

- [ ] **Step 4: Commit**

```bash
git add components/course-card/course-card.vue
git commit -m "feat(course-card): 精品/推荐/新角标"
```

---

## Phase C：测试与部署

### Task C1: H5 逐功能验证

**Files:** 无（手工验证清单）

- [ ] **Step 1: 后端本地启动并验证接口透出**

启动 strapi 后验证：
- `GET /api/zhao-common/v1/public/config` 返回 `site.speedPrivilegedRoles`（默认 `["admin"]`）
- `GET /api/zhao-course/v1/courses/:id` 返回 `isTop/isRecommended/featureFlags`
- `GET /api/zhao-course/v1/course-lessons?populate[quizzes]=true` 返回 `quizzes`

- [ ] **Step 2: H5 播放器逐项验证（启用 featureFlags 的测试课程）**

| 功能 | 预期 |
|---|---|
| 倍速按钮 | `playbackSpeed:true` 显示；`false` 隐藏 |
| 特权放行 | `playbackSpeed:false + vipSpeedOverride:true`，admin 角色显示倍速、普通用户隐藏 |
| 倍速记忆 | 切到 1.5x 后退出重进自动 1.5x |
| 横竖屏 | 点 ⛶ 进入横屏、再点退出 |
| 防误触锁定 | 锁定后控制条消失、遮罩拦截、🔓 可解锁 |
| 画中画 | H5 支持环境点 ▣ 出小窗、再点退出；不支持环境按钮隐藏 |
| seekMode=locked | 进度条不可拖 + 提示「本节课进度锁定」 |
| seekMode=played_only | 只能拖回已播区间，未播部分锁灰 |
| seekMode=free（未配置 featureFlags 的存量课） | 自由拖动，行为不变 |
| 断点续播 | 有进度课程进入后 maxPlayedTime=恢复点，可拖回已看部分 |
| 自动连播 | `autoNext:true` 无测验课时播放结束 → toast + 自动播下一节；有测验 → 弹答题 |
| 答题按钮 | 课时有关联测验时播放器右上常驻「📝答题」；无测验不显示 |
| 原生控件 | `controls:false` 后无原生控制条，仅自定义控制条 |

- [ ] **Step 3: 列表/卡片验证**

| 项 | 预期 |
|---|---|
| 综合推荐排序 | 置顶课程排最前 |
| 精选/推荐芯片 | 分别按 isFeatured/isRecommended 过滤 |
| 最新芯片 | 按最新发布排序 |
| 卡片角标 | 精品/推荐/新 按优先级最多 2 个，「新」=publishDate≤30 天 |

### Task C2: 小程序（MP）编译验证

- [ ] **Step 1: HBuilder X 编译运行**

Expected: 编译通过；画中画按钮隐藏（非 H5）；倍速/横竖屏/锁定/进度控制可用；`uni.createSelectorQuery` 进度拖拽正常。

### Task C3: 部署（后端）

- [ ] **Step 1: 提交并推送**（后端 dist 已提交于 Task A4；若 A4 后又有改动需重新构建并提交）

```bash
git add -A
git commit -m "build: 最终后端构建产物"
git push
```

- [ ] **Step 2: 服务器更新**（遵循部署铁律，不在服务器构建）

```bash
git pull
pm2 restart strapi
```

- [ ] **Step 3: 线上回归**：重复 C1 关键项（接口透出 + 播放器核心功能 + 列表排序）。
