# 全局微信分享 Meta + JS-SDK 双保险设计

日期：2026-08-27

## 背景与问题

C 端（v.joho.cn）活动详情页在微信内转发时，分享卡片不显示活动标题、描述、图片，显示的是默认「学习课程，答题赢积分」。

根因：
- 微信分享基础设施（`utils/wx-jssdk.ts` + `utils/share.ts`）已于 07-31 建立，但仅 index / course-detail / video-player / profile / login / register 6 个页面接入。
- 活动详情页 `pages/activity/detail.vue` 的 `onShow` 只做 `restoreSignupState()`，从未调用 `setupPageShare`。
- `App.vue` `onShow` 无参调用 `configShareWithInvite()`，此时 `currentPageShare` 为 null，标题/描述/图片全部落到租户配置或默认值。

## 目标

- 微信内转发任意业务页面，分享卡片正确显示对应标题、描述、图片。
- 微信抓取优先读页面 `og:*` meta（`og:title` / `og:description` / `og:image` + `document.title`），JS-SDK `updateAppMessageShareData` 作为兜底，双保险。
- 全局扫描补齐所有业务页面的分享/meta 配置。

## 非目标（不做）

- 不新增后端接口，不改后端数据。
- 不引入新依赖。
- 不改小程序端分享逻辑（`App.vue` 的 `onShareAppMessage` 保持现状）。
- 不重构已有 6 个页面的接入方式（仅复用）。

## 架构

### 1. 新增 `utils/seo-meta.ts`

```ts
export interface SeoMetaInput { title?: string; desc?: string; imgUrl?: string }

// 更新 document.title + 动态 upsert og:title / og:description / og:image
export function applySeoMeta(meta: SeoMetaInput): void
```

要点：
- 仅 H5 生效（`#ifdef H5` 或运行时判断 `typeof window !== 'undefined'`）。
- `imgUrl` 必须是绝对 URL；为空/非法时不写 `og:image`。
- `og:*` meta 不存在时创建，存在时更新属性，避免重复。

### 2. 改造 `utils/share.ts` 的 `setupPageShare`

H5 端执行顺序：先 `applySeoMeta({ title, desc, imgUrl })`，再 `window.setPageShare(...)`（JS-SDK 兜底）。

- 已接入的 6 个页面自动获得 meta，无需额外改动。
- 后续页面只需接 `setupPageShare` 一处即双生效。

### 3. 页面分级接入（全局扫描补齐）

#### 动态数据页（真实 title + description + 封面图）

| 页面 | 标题 | 描述 | 图片 |
|---|---|---|---|
| activity/detail | activity.title | activity.description（截断 ~60 字） | cover 模块 bgImage → promoAssets[0] → assets[0]，resolveMediaUrl |
| activity/promo | activity.title + 活动宣传 | activity.description | 同上 |
| exchange/detail | 商品/兑换标题 | 商品描述 | 商品图（如有） |
| partner/customer-detail | 客户姓名/标题 | — | — |
| pickup-location/detail | 自提点名称 | 自提点地址/说明 | — |

#### 静态标题页（固定 title，desc/图走租户或默认兜底）

activity/list、activity/calendar、activity/my、activity/series、my-course、notice、exchange（列表）、points-record、redeem-record、sign-in、tasks、guide、forgot-password、quiz/quiz、quiz/practice、quiz/exam/index、wrong-quiz/index、pickup-location/list、partner/customers

- 这些页面调用 `setupPageShare({ title: '页面标题' })`，desc/imgUrl 不传，走兜底链。

### 4. 兜底链（优先级从高到低）

```
页面数据（title/desc/imgUrl）
  → 租户 shareTitle / shareDescription / shareImage
  → 默认「学习课程，答题赢积分」/ BASE_URL/static/share-image.png
```

- 与现有 `setupPageShare` / `configShareWithInvite` 优先级一致。
- `App.vue` `onShow` 的无参 `configShareWithInvite()` 保留作为最后一层兜底。

## 关键容错

- 页面无图/无描述时，字段传 `undefined`（不传），**禁止传空字符串**——否则空串经 `??` 链覆盖租户/默认兜底，导致「有配置却没图/没描述」。
- 分享图一律 `resolveMediaUrl` 转绝对 URL（微信需可公网抓取）。
- `setupPageShare` 的 `pageUrl` 默认当前页面地址；登录用户自动附加 `inviteCode`（现有逻辑，保持不变）。

## 数据流

```
页面 onLoad/数据加载完成
  → setupPageShare({ title, desc, imgUrl, pageUrl })
    → applySeoMeta(...)          // meta 双保险
    → window.setPageShare(...)   // JS-SDK updateAppMessageShareData/TimelineShareData
      → configShareWithInvite()  // 附 inviteCode / inviterId
```

## 验证方式

- 本地/线上微信内置浏览器打开活动详情页，右上角转发：卡片显示活动标题、描述、封面图。
- 无封面图的活动：卡片图回退租户 shareImage / 默认 share-image.png。
- 列表类页面转发：显示页面标题 + 默认图。
- 检查 `document.title` 与 `og:*` meta 标签随路由切换正确更新。

## 涉及文件

| 文件 | 动作 |
|---|---|
| `utils/seo-meta.ts` | 新增 |
| `utils/share.ts` | 修改（setupPageShare 增加 applySeoMeta 调用） |
| `pages/activity/detail.vue` | 修改（接 setupPageShare，动态数据） |
| `pages/activity/promo.vue` 等动态页 | 修改（接 setupPageShare） |
| 静态标题页若干 | 修改（接 setupPageShare） |
