# H5 微信分享修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 H5 微信环境分享配置缺失问题，使分享封面图正常显示，分享标题/描述/URL 优先使用页面配置、租户配置兜底，登录用户自动附加邀请码。

**Architecture:** 三层修复：配置层修复 shareImage 媒体对象解析为 URL 字符串；分享逻辑层增强 link 优先级链并新建统一辅助函数 `setupPageShare`；页面层在 6 个业务页面接入 `setupPageShare`。

**Tech Stack:** uni-app (Vue3 + TypeScript), 微信 JS-SDK, hash 路由

**Spec:** `docs/superpowers/specs/2026-07-31-h5-wechat-share-design.md`

**注意:** 项目无单元测试框架，验证方式为代码审查 + 控制台日志 + 手动测试。git 命令需用完整路径 `& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course`。

---

### Task 1: 修复 auth-config.ts 的 shareImage 媒体对象解析

**Files:**
- Modify: `d:\zhao\strapi-course\services\auth-config.ts`

- [ ] **Step 1: 添加 BASE_URL import 和 resolveMediaUrl 函数**

在 `auth-config.ts` 文件顶部 import 区域，添加 `BASE_URL` 导入（在现有 `import { SITE_DOMAIN } from '../utils/env'` 之后）：

```typescript
import { SITE_DOMAIN, BASE_URL } from '../utils/env'
```

在 `DEFAULT_CONFIG` 常量定义之前（约第 73 行 `let cachedConfig` 之前），添加 `resolveMediaUrl` 函数：

```typescript
/**
 * 从媒体对象或字符串中提取完整图片 URL
 * 兼容三种格式：媒体对象 { url, provider_metadata } / 字符串路径 / 完整 URL
 */
function resolveMediaUrl(media: any): string {
  if (!media) return ''
  // 已是字符串（向后兼容）
  if (typeof media === 'string') {
    return media.startsWith('http') ? media : `${BASE_URL}${media}`
  }
  // 媒体对象：优先 OSS，其次 localUrl + BASE_URL，最后 url + BASE_URL
  const meta = media.provider_metadata
  if (meta?.ossUrl && meta.ossStatus === 'success') return meta.ossUrl
  const raw = meta?.localUrl || media.url
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `${BASE_URL}${raw}`
}
```

- [ ] **Step 2: 修改 shareImage 赋值**

在 `fetchAuthConfig` 函数中（约第 124 行），将：

```typescript
      shareImage: data.site?.shareImage ?? DEFAULT_CONFIG.shareImage,
```

改为：

```typescript
      shareImage: resolveMediaUrl(data.site?.shareImage),
```

- [ ] **Step 3: 验证改动无语法错误**

检查文件无 TypeScript 报错（IDE 红线检查）。确认 `BASE_URL` 已从 `../utils/env` 正确导出（该文件第 6 行已有 `export const BASE_URL`）。

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add services/auth-config.ts
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "fix: resolve shareImage media object to URL string in auth-config"
```

---

### Task 2: 增强 wx-jssdk.ts 的 link 逻辑

**Files:**
- Modify: `d:\zhao\strapi-course\utils\wx-jssdk.ts`

- [ ] **Step 1: 添加 resolveShareUrl 函数**

在 `wx-jssdk.ts` 文件中，`DEFAULT_SHARE` 常量之后（约第 24 行），添加 `resolveShareUrl` 函数：

```typescript
/**
 * 将 sharePath 补全为完整 URL
 * - 已带 http(s):// → 直接返回
 * - 相对路径（如 /pages/index/index）→ 拼接 window.location.origin
 */
function resolveShareUrl(sharePath: string | undefined): string {
  const base = window.location.origin
  if (!sharePath) return base
  if (sharePath.startsWith('http://') || sharePath.startsWith('https://')) {
    return sharePath
  }
  const path = sharePath.startsWith('/') ? sharePath : `/${sharePath}`
  return `${base}${path}`
}
```

- [ ] **Step 2: 修改 configShareWithInvite 的 link 逻辑**

在 `configShareWithInvite` 函数中（约第 145 行），将：

```typescript
  let link = cfg.pageUrl ?? baseUrl
```

改为：

```typescript
  // 优先级：页面 pageUrl > 租户 sharePath（补全为完整 URL）> baseUrl
  let link = cfg.pageUrl
    ?? resolveShareUrl(authConfig?.sharePath)
    ?? baseUrl
```

- [ ] **Step 3: 验证改动无语法错误**

检查文件无 TypeScript 报错。确认 `window.location.origin` 在 H5 环境可用（该文件已有 `window.location.href` 用法）。

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add utils/wx-jssdk.ts
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "fix: enhance configShareWithInvite link priority with sharePath fallback"
```

---

### Task 3: 新建 utils/share.ts 统一分享辅助函数

**Files:**
- Create: `d:\zhao\strapi-course\utils\share.ts`

- [ ] **Step 1: 创建 share.ts 文件**

创建 `d:\zhao\strapi-course\utils\share.ts`，完整内容如下：

```typescript
/**
 * 统一分享辅助函数
 * H5 端调用 setPageShare 配置微信 JS-SDK 分享
 * 小程序端返回配置对象供 onShareAppMessage / onShareTimeline 使用
 */
import { getStoredAuthConfig } from '../services/auth-config'
import { getInviteCode } from './invite'
import { getUser } from './storage'

export interface PageShareInput {
  title?: string
  desc?: string
  imgUrl?: string
  /** 自定义落地页 URL；不传则用当前页面地址 */
  pageUrl?: string
}

export interface ShareConfig {
  title: string
  desc: string
  imgUrl: string
  pageUrl: string
}

/**
 * 将 inviteCode 参数附加到 URL（hash 路由兼容）
 * uni-app H5 使用 hash 路由，URL 格式如 http://host/#/pages/index/index?key=val
 * hash 路由的 query 参数在 # 之后，需要用 hash 单独处理
 */
function appendInviteCode(url: string, inviteCode: string): string {
  if (!inviteCode) return url

  // 拆分 hash 部分
  const [origin, hash = ''] = url.split('#')
  let path = hash
  let query = ''

  // hash 路由的 query 在 ? 之后
  const qIdx = hash.indexOf('?')
  if (qIdx >= 0) {
    path = hash.substring(0, qIdx)
    query = hash.substring(qIdx + 1)
  }

  const params = new URLSearchParams(query)
  if (params.has('inviteCode')) return url  // 已存在不重复附加

  params.set('inviteCode', inviteCode)
  return `${origin}#${path}?${params.toString()}`
}

/**
 * 统一设置页面分享（H5 + 小程序通用）
 *
 * 优先级：
 *   - title/desc/imgUrl: 页面传入 > 租户配置(authConfig) > 空字符串
 *   - pageUrl: 页面传入 > 当前页面地址 > 租户 sharePath
 *
 * 邀请码：仅登录用户（getUser() 不为 null）才附加 inviteCode
 *
 * @param input 页面分享配置（可选字段，缺失用租户配置兜底）
 * @returns 小程序端返回 ShareConfig 供 onShareAppMessage 使用；H5 端无返回
 */
export function setupPageShare(input: PageShareInput = {}): ShareConfig | void {
  const authConfig = getStoredAuthConfig()

  // 优先级：页面传入 > 租户配置 > 空字符串
  const title = input.title ?? authConfig?.shareTitle ?? ''
  const desc = input.desc ?? authConfig?.shareDescription ?? ''
  const imgUrl = input.imgUrl ?? authConfig?.shareImage ?? ''

  // pageUrl 优先级：页面传入 > 当前页面地址
  const pageUrl = input.pageUrl ?? window.location.href

  // 仅登录用户附加邀请码
  const user = getUser()
  let finalUrl = pageUrl
  if (user) {
    const inviteCode = getInviteCode()
    finalUrl = appendInviteCode(pageUrl, inviteCode)
  }

  const config: ShareConfig = { title, desc, imgUrl, pageUrl: finalUrl }

  // #ifdef H5
  if (typeof window !== 'undefined' && (window as any).setPageShare) {
    ;(window as any).setPageShare(config)
  }
  // #endif

  // #ifndef H5
  return config
  // #endif
}
```

- [ ] **Step 2: 验证 import 路径正确**

确认以下 import 都指向已存在的导出：
- `getStoredAuthConfig` — `services/auth-config.ts` 第 181 行 `export function getStoredAuthConfig`
- `getInviteCode` — `utils/invite.ts` 第 295 行 `export { getInviteCode, ... }`
- `getUser` — `utils/storage.ts` 第 47 行 `export function getUser`

- [ ] **Step 3: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add utils/share.ts
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "feat: add unified setupPageShare helper for H5 and mini-program sharing"
```

---

### Task 4: 首页接入 setupPageShare

**Files:**
- Modify: `d:\zhao\strapi-course\pages\index\index.vue`

- [ ] **Step 1: 添加 setupPageShare import**

在 `pages/index/index.vue` 第 145 行 `import { getStoredAuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

- [ ] **Step 2: 替换原有 setPageShare 调用**

将第 148-153 行的 H5 微信环境 setPageShare 代码块：

```typescript
// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
// H5 微信环境:用 wx-jssdk 的 setPageShare 配置分享(小程序的 onShareAppMessage 在 H5 不生效)
if (typeof window !== 'undefined' && isWechatBrowser() && (window as any).setPageShare) {
  ;(window as any).setPageShare({ pageUrl: `${window.location.origin}/#/pages/index/index` })
}
// #endif
```

替换为：

```typescript
// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
// H5 微信环境:用 setupPageShare 配置分享(小程序的 onShareAppMessage 在 H5 不生效)
if (typeof window !== 'undefined' && isWechatBrowser()) {
  setupPageShare()
}
// #endif
```

- [ ] **Step 3: 在 onShow 中添加 setupPageShare 调用**

将第 352-355 行的 onShow：

```typescript
onShow(() => {
  // 每次页面显示时刷新数据（如登录后返回首页）
  refreshData()
})
```

改为：

```typescript
onShow(() => {
  // 每次页面显示时刷新数据（如登录后返回首页）
  refreshData()
  // H5 微信环境：刷新分享配置（用租户配置兜底 + 登录用户附加邀请码）
  // #ifdef H5
  setupPageShare()
  // #endif
})
```

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add pages/index/index.vue
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "feat: integrate setupPageShare in homepage"
```

---

### Task 5: 课程详情页接入 setupPageShare

**Files:**
- Modify: `d:\zhao\strapi-course\pages\course-detail\course-detail.vue`

- [ ] **Step 1: 添加 setupPageShare 和 onShow import**

在 `pages/course-detail/course-detail.vue` 第 95 行 `import { ref, computed, onMounted } from 'vue'` 改为：

```typescript
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
```

在第 98 行 `import { getStoredAuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

- [ ] **Step 2: 在 loadData 函数末尾添加 setupPageShare 调用**

在 `loadData` 函数中，`course.value = courseRes ?? null` 之后（约第 137 行），添加分享配置。找到 `loadData` 函数的末尾（在 `} catch` 之前），添加：

```typescript
  // 配置微信分享（课程标题、简介、封面）
  // #ifdef H5
  if (course.value) {
    setupPageShare({
      title: course.value.title,
      desc: course.value.description,
      imgUrl: course.value.coverUrl,
    })
  }
  // #endif
```

- [ ] **Step 3: 添加 onShow 生命周期刷新分享**

在 `onMounted` 调用之后（文件 script 末尾 `</script>` 之前），添加：

```typescript
onShow(() => {
  // H5 微信环境：每次页面显示刷新分享配置
  // #ifdef H5
  if (course.value) {
    setupPageShare({
      title: course.value.title,
      desc: course.value.description,
      imgUrl: course.value.coverUrl,
    })
  }
  // #endif
})
```

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add pages/course-detail/course-detail.vue
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "feat: integrate setupPageShare in course detail page"
```

---

### Task 6: 视频播放页接入 setupPageShare

**Files:**
- Modify: `d:\zhao\strapi-course\pages\video-player\video-player.vue`

- [ ] **Step 1: 添加 onShow 和 setupPageShare import**

在第 148 行 `import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'` 之后，添加：

```typescript
import { onShow } from '@dcloudio/uni-app'
```

在第 150 行 `import { getStoredAuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

- [ ] **Step 2: 在课程数据加载后添加 setupPageShare 调用**

找到 `loadData` 函数（或 `onMounted` 中加载课程数据的部分），在 `courseDetail.value = ...` 赋值之后，添加：

```typescript
  // 配置微信分享（课程标题、课时信息）
  // #ifdef H5
  if (courseDetail.value) {
    const currentLesson = lessons.value[currentLessonIndex.value]
    setupPageShare({
      title: courseDetail.value.title,
      desc: currentLesson?.title || courseDetail.value.description || '',
      imgUrl: courseDetail.value.coverUrl,
    })
  }
  // #endif
```

- [ ] **Step 3: 添加 onShow 刷新分享**

在 `onMounted` 之后添加：

```typescript
onShow(() => {
  // H5 微信环境：刷新分享配置
  // #ifdef H5
  if (courseDetail.value) {
    const currentLesson = lessons.value[currentLessonIndex.value]
    setupPageShare({
      title: courseDetail.value.title,
      desc: currentLesson?.title || courseDetail.value.description || '',
      imgUrl: courseDetail.value.coverUrl,
    })
  }
  // #endif
})
```

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add pages/video-player/video-player.vue
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "feat: integrate setupPageShare in video player page"
```

---

### Task 7: 个人中心、登录页、注册页接入 setupPageShare

**Files:**
- Modify: `d:\zhao\strapi-course\pages\profile\profile.vue`
- Modify: `d:\zhao\strapi-course\pages\login\login.vue`
- Modify: `d:\zhao\strapi-course\pages\register\register.vue`

- [ ] **Step 1: 个人中心 profile.vue 接入**

在 `pages/profile/profile.vue` 第 252 行 `import { onShow } from '@dcloudio/uni-app'` 已存在。在第 257 行 `import { getStoredAuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

在第 522 行的 `onShow` 中：

```typescript
onShow(() => {
  updateGuestMode()
  if (!guestMode.value) {
    loadData()
  }
})
```

改为：

```typescript
onShow(() => {
  updateGuestMode()
  if (!guestMode.value) {
    loadData()
  }
  // H5 微信环境：配置分享（标题用"个人中心"，其余租户兜底）
  // #ifdef H5
  setupPageShare({ title: '个人中心' })
  // #endif
})
```

- [ ] **Step 2: 登录页 login.vue 接入**

在 `pages/login/login.vue` 中，需要添加 `onShow` 和 `setupPageShare` 的 import。在第 338 行 `import { ref, computed, onUnmounted, onMounted } from 'vue'` 之后，添加：

```typescript
import { onShow } from '@dcloudio/uni-app'
```

在第 342 行 `import type { AuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

在 `onMounted` 之后（约第 524 行之后），添加：

```typescript
onShow(() => {
  // H5 微信环境：配置分享（标题用"登录"，其余租户兜底）
  // #ifdef H5
  setupPageShare({ title: '登录' })
  // #endif
})
```

- [ ] **Step 3: 注册页 register.vue 接入**

在 `pages/register/register.vue` 第 110 行 `import { ref, computed, onMounted } from 'vue'` 之后，添加：

```typescript
import { onShow } from '@dcloudio/uni-app'
```

在第 113 行 `import { getStoredAuthConfig, fetchAuthConfig } from '../../services/auth-config'` 之后，添加：

```typescript
import { setupPageShare } from '../../utils/share'
```

在 `onMounted` 之后（约第 134 行之后），添加：

```typescript
onShow(() => {
  // H5 微信环境：配置分享（标题用"注册"，其余租户兜底）
  // #ifdef H5
  setupPageShare({ title: '注册' })
  // #endif
})
```

- [ ] **Step 4: Commit**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add pages/profile/profile.vue pages/login/login.vue pages/register/register.vue
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "feat: integrate setupPageShare in profile, login, register pages"
```

---

### Task 8: 全局验证

**Files:**
- 无文件修改，仅验证

- [ ] **Step 1: 检查所有 setupPageShare 调用点**

全局搜索确认所有页面都已接入：
```
搜索关键词: setupPageShare
预期文件:
- utils/share.ts (定义)
- pages/index/index.vue
- pages/course-detail/course-detail.vue
- pages/video-player/video-player.vue
- pages/profile/profile.vue
- pages/login/login.vue
- pages/register/register.vue
```

- [ ] **Step 2: 检查原有 setPageShare 引用是否已清理**

搜索 `setPageShare` 确认：
- `App.vue` 中的 `window.setPageShare = setPageShare` 全局暴露保留（这是必须的）
- `pages/index/index.vue` 中原有直接调用 `(window as any).setPageShare` 已替换为 `setupPageShare`

- [ ] **Step 3: 检查 shareImage 类型一致性**

确认 `auth-config.ts` 中 `AuthConfig` 接口的 `shareImage: string` 类型未变，且赋值处 `resolveMediaUrl()` 返回 `string`。

- [ ] **Step 4: 检查小程序端 onShareAppMessage 不受影响**

确认 `pages/index/index.vue` 的 `onShareAppMessage` 和 `onShareTimeline` 仍保留（小程序端使用），且 `authConfig?.shareImage` 现在是字符串 URL（修复后），小程序端的 `imageUrl` 会得到正确的 URL。

- [ ] **Step 5: 手动验证（如有运行环境）**

启动 dev server，用 `?debugWx=1` 参数访问以下页面，检查控制台无报错：
- 首页 `http://localhost:5173/#/pages/index/index?debugWx=1`
- 课程详情页（需有效 courseId）
- 个人中心

确认分享配置生效（需微信开发者工具或微信内打开）。

- [ ] **Step 6: 最终 Commit（如有验证修复）**

```bash
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course add -A
& 'C:\Program Files\Git\cmd\git.exe' -C d:\zhao\strapi-course commit -m "fix: verification and cleanup for H5 wechat share"
```
