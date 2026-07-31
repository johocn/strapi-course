# H5 微信分享修复设计

> **日期**: 2026-07-31
> **项目**: strapi-course
> **范围**: Task 2 — 修复 H5 微信环境分享配置缺失问题

## 背景与问题

### 当前问题

1. **分享封面图不显示**: `auth-config.ts` 中 `shareImage` 字段直接赋值 `data.site?.shareImage`，但 API 返回的是媒体对象（含 `url`、`provider_metadata` 等），而类型声明为 `string`。`wx-jssdk.ts` 将该对象直接传给微信 JS-SDK，导致图片无法显示。

2. **sharePath 未使用**: `configShareWithInvite` 中 `link` 只取 `cfg.pageUrl ?? baseUrl`，完全忽略了租户配置的 `sharePath`。

3. **只有首页有分享配置**: 整个项目仅 `pages/index/index.vue` 调用了 `setPageShare`，且只传了 `pageUrl`，没有传 title/desc/imgUrl。其他业务页面无分享配置。

4. **首页 H5 分享缺失字段**: 首页 H5 分享仅设置 `pageUrl`，未使用租户配置的 shareTitle/shareDescription/shareImage 作为兜底。

### API 返回的数据格式

租户配置接口 `/zhao-common/v1/public/config` 返回的 `shareImage` 为媒体对象：

```json
{
  "data": {
    "site": {
      "shareTitle": "圣麟教育",
      "shareDescription": "让学习更有价值",
      "shareImage": {
        "id": 6,
        "documentId": "obz4qim0f0rxtmro9fswikdi",
        "name": "logo.png",
        "mime": "image/png",
        "url": "/static/course/thumbnails/071dbdc6537127d883b4c5232b508105.png",
        "provider": "zhao-oss-local",
        "provider_metadata": {
          "ossUrl": null,
          "localUrl": "/static/course/thumbnails/071dbdc6537127d883b4c5232b508105.png",
          "ossStatus": "pending"
        }
      },
      "sharePath": "/pages/index/index"
    }
  }
}
```

`sharePath` 为相对路径（如 `/pages/index/index`），需补全为完整 URL。若已带 `http://` 或 `https://` 则直接使用。

## 设计方案

采用**方案 B：统一分享工具函数**。核心思路：修复数据源 + 新建统一辅助函数 + 各页面接入。

### 架构

```
配置层 (auth-config.ts)
  └── resolveMediaUrl: 媒体对象 → URL 字符串
  └── sharePath 透传（补全逻辑在 wx-jssdk.ts）

分享逻辑层
  ├── wx-jssdk.ts (修改)
  │   └── resolveShareUrl: sharePath → 完整 URL
  │   └── configShareWithInvite: link 优先级链增强
  └── share.ts (新建)
      └── setupPageShare: 统一页面分享入口

页面层
  └── 各页面 onShow → setupPageShare(input)
```

## 详细设计

### 1. `services/auth-config.ts` — 修复 shareImage 解析

新增内部函数 `resolveMediaUrl`，从媒体对象或字符串中提取完整图片 URL。

```typescript
import { BASE_URL } from '../utils/env'

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

赋值处修改：

```typescript
shareImage: resolveMediaUrl(data.site?.shareImage),
sharePath: data.site?.sharePath ?? '/pages/index/index',
```

`AuthConfig` 接口中 `shareImage: string` 类型保持不变（修复后确实是字符串）。

### 2. `utils/wx-jssdk.ts` — 增强 link 逻辑

新增内部函数 `resolveShareUrl`：

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

`configShareWithInvite` 中 link 逻辑修改：

```typescript
// 优先级：页面 pageUrl > 租户 sharePath（补全）> baseUrl
let link = cfg.pageUrl
  ?? resolveShareUrl(authConfig?.sharePath)
  ?? baseUrl
```

### 3. `utils/share.ts` — 新建统一分享辅助函数

```typescript
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

### 4. 页面接入

| 页面 | 文件路径 | 分享数据来源 |
|------|---------|------------|
| 首页 | `pages/index/index.vue` | 全部用租户配置兜底，pageUrl 默认当前地址 |
| 课程详情 | `pages/course-detail/course-detail.vue` | title=课程标题, desc=课程简介, imgUrl=课程封面 |
| 视频播放 | `pages/video-player/video-player.vue` | title=课程标题, desc=课时标题, imgUrl=课程封面 |
| 个人中心 | `pages/profile/profile.vue` | 标题用"个人中心"，其余租户兜底 |
| 登录页 | `pages/login/login.vue` | 标题用"登录"，其余租户兜底 |
| 注册页 | `pages/register/register.vue` | 标题用"注册"，其余租户兜底 |

**接入方式**：在 `onShow` 生命周期中调用 `setupPageShare()`，数据加载完成后传入页面特定配置。

**首页示例**：
```typescript
import { setupPageShare } from '../../utils/share'

onShow(() => {
  refreshData()
  setupPageShare()
})
```

**课程详情页示例**：
```typescript
import { setupPageShare } from '../../utils/share'

// 数据加载完成后
setupPageShare({
  title: course.value.title,
  desc: course.value.description,
  imgUrl: course.value.coverUrl,
})
```

**App.vue 无改动**：`onShow` 中已有 `configShareWithInvite()` 无参调用，修复后自动走租户 `sharePath` 兜底。

## 优先级规则

### link/pageUrl 优先级

1. 页面显式传入的 `input.pageUrl`
2. 当前页面地址（`window.location.href`）— `setupPageShare` 默认值
3. 租户 `sharePath`（补全为完整 URL）— 兜底
4. `window.location.origin` — 最终兜底

### title/desc/imgUrl 优先级

1. 页面传入（如课程标题、简介、封面）
2. 租户配置（`authConfig.shareTitle` / `shareDescription` / `shareImage`）
3. `DEFAULT_SHARE` 硬编码默认值

### 邀请码附加规则

- 仅登录用户（`getUser()` 不为 null）才附加 inviteCode
- 使用 URLSearchParams 检查，避免重复附加
- hash 路由兼容：参数附加在 `#` 之后的 query 部分（如 `http://host/#/pages/index/index?inviteCode=xxx`）
- 原 URL 已有 query 参数 → 用 `&` 连接
- 原 URL 无 query 参数 → 用 `?` 连接

## 错误处理与边界情况

### 媒体 URL 解析

- `shareImage` 为 null/undefined → 返回空字符串
- `shareImage` 为字符串 → 直接返回或拼接 `BASE_URL`
- `shareImage` 为媒体对象，OSS 已就绪 → 返回 `ossUrl`
- `shareImage` 为媒体对象，OSS 未就绪 → 用 `localUrl` 或 `url` 拼接 `BASE_URL`
- `shareImage` 为媒体对象，url 和 metadata 都空 → 返回空字符串（触发 DEFAULT_SHARE 兜底）

### sharePath 补全

- `sharePath` 为空/undefined → 返回 `window.location.origin`
- `sharePath` 已带 `http://` 或 `https://` → 直接返回
- `sharePath` 为相对路径 → 拼接 origin
- `sharePath` 不以 `/` 开头 → 补 `/` 后拼接

### 非微信浏览器

- `configShareWithInvite` 内部有 `typeof wx !== 'undefined'` 检查
- 非微信浏览器调用 `setPageShare` 时静默存入 `currentPageShare`，不报错

## 验证方式

采用手动验证 + 控制台日志验证。

### 验证清单

**A. 媒体 URL 解析**
- `shareImage` 为媒体对象，`ossStatus === 'success'` → 返回 `ossUrl`
- `shareImage` 为媒体对象，`ossStatus === 'pending'` → 返回 `BASE_URL + localUrl`
- `shareImage` 为 null → 返回空字符串

**B. sharePath 补全**
- `sharePath = '/pages/index/index'` → 补全为完整 URL
- `sharePath = 'https://example.com/page'` → 直接返回
- `sharePath` 为空 → 返回 `window.location.origin`

**C. 分享优先级**
- 页面传入 title → 微信分享卡片显示页面标题
- 页面不传 title → 显示租户 `shareTitle`
- 租户未配置 → 显示 `DEFAULT_SHARE.title`

**D. 邀请码附加**
- 已登录用户分享 → URL hash query 包含 `inviteCode=xxx`
- 未登录用户分享 → URL 不包含 inviteCode
- hash 路由 URL 已有 query 参数 → 用 `&` 连接
- URL 已包含 inviteCode → 不重复附加

**E. H5 微信环境**
- 用 `?debugWx=1` 进入各页面 → 控制台无报错，分享配置正确生效
- 检查 `wx.updateAppMessageShareData` 和 `wx.updateTimelineShareData` 被正确调用

**F. 回归检查**
- 原有 `onShareAppMessage` / `onShareTimeline`（小程序端）不受影响
- `App.vue` 的 `configShareWithInvite()` 无参调用仍正常工作

## 改动文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `services/auth-config.ts` | 修改 | 修复 shareImage 对象解析为 URL 字符串 |
| `utils/wx-jssdk.ts` | 修改 | 增强 link 逻辑，新增 resolveShareUrl |
| `utils/share.ts` | 新建 | 统一分享辅助函数 setupPageShare |
| `pages/index/index.vue` | 修改 | 接入 setupPageShare 替换原 setPageShare |
| `pages/course-detail/course-detail.vue` | 修改 | 接入 setupPageShare |
| `pages/video-player/video-player.vue` | 修改 | 接入 setupPageShare |
| `pages/profile/profile.vue` | 修改 | 接入 setupPageShare |
| `pages/login/login.vue` | 修改 | 接入 setupPageShare |
| `pages/register/register.vue` | 修改 | 接入 setupPageShare |
