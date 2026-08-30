# 全局微信分享 Meta + JS-SDK 双保险 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全局扫描补齐 C 端（v.joho.cn）所有业务页面的微信分享配置——新增 `og:*` meta 注入（微信优先抓取）+ 保留 JS-SDK `setPageShare` 兜底，活动详情页转发正确显示标题/描述/封面图。

**Architecture:** 新增 `utils/seo-meta.ts` 的 `applySeoMeta()` 统一更新 `document.title` + `og:title/og:description/og:image`；改造 `utils/share.ts` 的 `setupPageShare()`，在 H5 端先写 meta 再调 `window.setPageShare`，使页面只需接入一处即双生效；按「动态数据页 / 静态标题页」分级补齐全部业务页面。

**Tech Stack:** uni-app (vue3 script setup) H5、微信 JS-SDK（`window.setPageShare`）、TypeScript。不新增依赖。

**前置约定：**
- 兜底链：页面数据 → 租户 `shareTitle/shareDescription/shareImage` → 默认「学习课程，答题赢积分」/ `BASE_URL/static/share-image.png`（由 `setupPageShare` 与 `App.vue configShareWithInvite` 现有逻辑保证，本计划不改）。
- 容错铁律：页面无图/无描述时传 `undefined`（不传），禁止空字符串，避免空串经 `??` 链覆盖兜底。
- 分享图一律用 `resolveMediaUrl` 转绝对 URL。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `utils/seo-meta.ts` | 新增 | `applySeoMeta` 更新 document.title + og:* meta |
| `utils/share.ts` | 修改 | `setupPageShare` H5 端先 applySeoMeta 再 setPageShare |
| `pages/activity/detail.vue` | 修改 | 动态分享：活动标题/描述/封面 |
| `pages/activity/promo.vue` | 修改 | 动态分享：活动标题/描述 |
| `pages/exchange/detail.vue` | 修改 | 动态分享：商品名/副标题/封面 |
| `pages/pickup-location/detail.vue` | 修改 | 动态分享：自提点名称/地址 |
| `pages/partner/customer-detail.vue` | 修改 | 静态标题「客户详情」 |
| 静态标题页 18 个 | 修改 | 各页面固定标题分享 |

---

## Task 1: 新增 `utils/seo-meta.ts`

**Files:**
- Create: `e:\code\shao\utils\seo-meta.ts`

- [ ] **Step 1: 写入 seo-meta.ts**

```ts
/**
 * 微信分享 meta 注入（H5 端）
 * 微信抓取分享卡片优先读 og:title / og:description / og:image，此处动态 upsert，
 * JS-SDK（setupPageShare）作为兜底。imgUrl 必须为绝对 URL。
 */
export interface SeoMetaInput {
  title?: string
  desc?: string
  imgUrl?: string
}

function upsertMeta(doc: Document, property: string, content?: string): void {
  if (!content) return
  let el = doc.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = doc.createElement('meta')
    el.setAttribute('property', property)
    doc.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applySeoMeta(meta: SeoMetaInput): void {
  if (typeof window === 'undefined' || !window.document) return
  const doc = window.document
  if (meta.title) doc.title = meta.title
  upsertMeta(doc, 'og:title', meta.title)
  upsertMeta(doc, 'og:description', meta.desc)
  upsertMeta(doc, 'og:image', meta.imgUrl)
}
```

- [ ] **Step 2: 冒烟验证（临时 node 脚本，零依赖）**

创建 `e:\code\shao\__seo-smoke.mjs`：

```js
// 最小 document stub，验证 applySeoMeta 的 upsert 与空值跳过逻辑
const metas = []
const doc = {
  title: '',
  head: { appendChild(el) { metas.push(el) } },
  querySelector(sel) {
    const prop = sel.match(/property="(.+)"/)[1]
    return metas.find((m) => m._attrs.property === prop) || null
  },
  createElement(tag) {
    return { tagName: tag, _attrs: {}, setAttribute(k, v) { this._attrs[k] = String(v) }, getAttribute(k) { return this._attrs[k] } }
  },
}
globalThis.window = { document: doc }

const src = await (await import('node:fs/promises')).readFile(new URL('./utils/seo-meta.ts', import.meta.url), 'utf8')
const code = src
  .replace(/^import .*$/m, '')
  .replace(/export interface[^}]*}\n\n/, '')
  .replace(/export function applySeoMeta/, 'function applySeoMeta')
eval(code)

applySeoMeta({ title: '活动标题', desc: '活动描述', imgUrl: 'https://x/1.png' })
applySeoMeta({ title: '活动标题2', desc: '', imgUrl: '' })
console.log('document.title =', doc.title)
console.log('metas =', metas.map((m) => m._attrs))
if (doc.title !== '活动标题2') throw new Error('FAIL: title 未更新')
if (metas.filter((m) => m._attrs.property === 'og:image').length !== 1) throw new Error('FAIL: og:image 重复')
if (metas.find((m) => m._attrs.property === 'og:image')._attrs.content !== 'https://x/1.png') throw new Error('FAIL: og:image 被空串覆盖')
console.log('PASS')
```

- [ ] **Step 3: 运行冒烟验证**

Run: `node __seo-smoke.mjs`（在 `e:\code\shao`）
Expected: 输出 `PASS`（title 更新为「活动标题2」；og:image 仅 1 个且内容保持 `https://x/1.png`，未被空串覆盖）

- [ ] **Step 4: 删除临时脚本**

Delete: `e:\code\shao\__seo-smoke.mjs`

- [ ] **Step 5: Commit**

```bash
git add utils/seo-meta.ts
git commit -m "feat(shao): add applySeoMeta for wechat og meta injection"
```

---

## Task 2: 改造 `utils/share.ts` 的 `setupPageShare`

**Files:**
- Modify: `e:\code\shao\utils\share.ts`

- [ ] **Step 1: 引入 applySeoMeta 并在 H5 端先写 meta**

在 `share.ts` 顶部 import 区追加：

```ts
import { applySeoMeta } from './seo-meta'
```

将 `setupPageShare` 中 `// #ifdef H5` 段改为（先 meta 后 JS-SDK）：

```ts
  // #ifdef H5
  applySeoMeta({ title, desc, imgUrl })
  if (typeof window !== 'undefined' && (window as any).setPageShare) {
    ;(window as any).setPageShare(config)
  }
  // #endif
```

注意：`title/desc/imgUrl` 此时已经过 `??` 兜底（可能为租户配置），传入 `applySeoMeta` 时若为**空字符串**会被 `upsertMeta` 的 `!content` 跳过，`og:*` 保持上一次非空值或缺失——与容错铁律一致。

- [ ] **Step 2: 检查已接入 6 页无需改动**

已接入页面（index/index、course-detail、video-player、profile、login、register）调用 `setupPageShare` 即自动获得 meta，无需改动。

- [ ] **Step 3: Commit**

```bash
git add utils/share.ts
git commit -m "feat(shao): apply og meta before js-sdk share in setupPageShare"
```

---

## Task 3: 活动详情页 `pages/activity/detail.vue` 接入（主诉）

**Files:**
- Modify: `e:\code\shao\pages\activity\detail.vue`

- [ ] **Step 1: 新增分享辅助函数**

在 `<script setup>` 中 import 区（L391 `import { isWechatBrowser } from '../../utils/env'` 之后）追加：

```ts
import { setupPageShare } from '../../utils/share'
import { resolveMediaUrl } from '../../utils/env'
```

在 `loadActivity()`（L812）`finally` 块之后追加分享辅助函数（复用 promo-cover 的取图优先级）：

```ts
// 分享图优先级：promoModules cover.bgImage → promoAssets[0] → 旧 assets[0]，与 promo-cover.vue 一致
function resolveActivityCover(a: any): string {
  const cover = (Array.isArray(a?.promoModules) ? a.promoModules : []).find((m: any) => m.type === 'cover')
  if (cover?.config?.bgImage) return resolveMediaUrl(cover.config.bgImage)
  const promoAssets = Array.isArray(a?.promoAssets) ? a.promoAssets : []
  if (promoAssets.length && promoAssets[0]?.url) return resolveMediaUrl(promoAssets[0].url)
  const legacy = Array.isArray(a?.assets) ? a.assets : []
  if (legacy.length && legacy[0]?.url) return resolveMediaUrl(legacy[0].url)
  return ''
}

function setupActivityShare() {
  const a = activity.value
  if (!a?.title) return
  const desc = (a.description || '').slice(0, 60) || undefined
  setupPageShare({ title: a.title, desc, imgUrl: resolveActivityCover(a) || undefined })
}
```

- [ ] **Step 2: 数据加载后调用**

在 `loadActivity()` 的 `try` 块内 `activity.value = res ?? null` 之后追加：

```ts
    setupActivityShare()
```

- [ ] **Step 3: onShow 刷新**

将 `onShow`（L1221）改为：

```ts
onShow(() => {
  if (id && activity.value) {
    restoreSignupState()
    setupActivityShare()
  }
})
```

- [ ] **Step 4: Commit**

```bash
git add pages/activity/detail.vue
git commit -m "feat(shao): wechat share meta for activity detail page"
```

---

## Task 4: 活动宣传页 `pages/activity/promo.vue` 接入

**Files:**
- Modify: `e:\code\shao\pages\activity\promo.vue`

- [ ] **Step 1: 新增 import 与分享函数**

在 `<script setup>`（L232）顶部 import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

在 `activity` computed（L282）之后追加：

```ts
function setupPromoShare() {
  const a = activity.value
  if (!a?.title) return
  const desc = (a.description || '').slice(0, 60) || undefined
  setupPageShare({ title: `${a.title}｜活动宣传`, desc, imgUrl: undefined })
}
```

- [ ] **Step 2: 数据加载后调用**

在 `onShow` 回调（L773-L787 区间）内、首次展示跳过逻辑之后追加：

```ts
  if (activity.value) setupPromoShare()
```

- [ ] **Step 3: Commit**

```bash
git add pages/activity/promo.vue
git commit -m "feat(shao): wechat share meta for activity promo page"
```

---

## Task 5: 其余动态数据页接入

**Files:**
- Modify: `e:\code\shao\pages\exchange\detail.vue`
- Modify: `e:\code\shao\pages\pickup-location\detail.vue`
- Modify: `e:\code\shao\pages\partner\customer-detail.vue`

- [ ] **Step 1: exchange/detail.vue**

import 区追加（`getMediaUrl` 已存在）：

```ts
import { setupPageShare } from '../../utils/share'
```

`loadProduct()`（L226）内 `product.value = {...}` 之后追加：

```ts
    setupPageShare({
      title: p.name || undefined,
      desc: p.subtitle || p.description || undefined,
      imgUrl: product.value.coverImageUrl || undefined,
    })
```

- [ ] **Step 2: pickup-location/detail.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`loadDetail()` 成功赋值 `detail.value` 之后追加：

```ts
  if (detail.value?.name) {
    setupPageShare({ title: detail.value.name, desc: detail.value.address || undefined, imgUrl: undefined })
  }
```

- [ ] **Step 3: partner/customer-detail.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`onLoad`（L234-L237）中 `loadDetail()` 之后追加：

```ts
  setupPageShare({ title: '客户详情' })
```

- [ ] **Step 4: Commit**

```bash
git add pages/exchange/detail.vue pages/pickup-location/detail.vue pages/partner/customer-detail.vue
git commit -m "feat(shao): wechat share meta for exchange/pickup/customer detail pages"
```

---

## Task 6: 活动相关静态页接入

**Files:**
- Modify: `e:\code\shao\pages\activity\list.vue`
- Modify: `e:\code\shao\pages\activity\calendar.vue`
- Modify: `e:\code\shao\pages\activity\my.vue`
- Modify: `e:\code\shao\pages\activity\series.vue`

每个页面统一两步：import 追加 + 生命周期回调内调用。

- [ ] **Step 1: activity/list.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`onMounted`（L158-L166）回调末尾追加：

```ts
  setupPageShare({ title: '活动列表' })
```

- [ ] **Step 2: activity/calendar.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`onLoad`（L141-L145）回调末尾追加：

```ts
  setupPageShare({ title: '活动日历' })
```

- [ ] **Step 3: activity/my.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`onMounted`（L145-L151 区间）回调末尾追加：

```ts
  setupPageShare({ title: '我的活动' })
```

- [ ] **Step 4: activity/series.vue**

import 区追加：

```ts
import { setupPageShare } from '../../utils/share'
```

`onLoad`（L93-L108 区间）回调末尾追加：

```ts
  setupPageShare({ title: '活动系列' })
```

- [ ] **Step 5: Commit**

```bash
git add pages/activity/list.vue pages/activity/calendar.vue pages/activity/my.vue pages/activity/series.vue
git commit -m "feat(shao): wechat share meta for activity static pages"
```

---

## Task 7: 课程/兑换/伙伴/自提点静态页接入

**Files:**
- Modify: `e:\code\shao\pages\my-course\my-course.vue`
- Modify: `e:\code\shao\pages\exchange\exchange.vue`
- Modify: `e:\code\shao\pages\partner\customers.vue`
- Modify: `e:\code\shao\pages\pickup-location\list.vue`

- [ ] **Step 1: my-course.vue**

import 追加 `import { setupPageShare } from '../../utils/share'`；`onMounted`（L415-L421）回调末尾追加 `setupPageShare({ title: '我的课程' })`。

- [ ] **Step 2: exchange.vue**

import 追加同上；`onMounted`（L778-L781）回调末尾追加 `setupPageShare({ title: '积分兑换' })`。

- [ ] **Step 3: customers.vue**

import 追加同上；`onShow`（L68-L70）回调末尾追加 `setupPageShare({ title: '我的客户' })`。

- [ ] **Step 4: pickup-location/list.vue**

import 追加同上；`onMounted`（L177-L182）回调末尾追加 `setupPageShare({ title: '自提点' })`。

- [ ] **Step 5: Commit**

```bash
git add pages/my-course/my-course.vue pages/exchange/exchange.vue pages/partner/customers.vue pages/pickup-location/list.vue
git commit -m "feat(shao): wechat share meta for course/exchange/customer/pickup pages"
```

---

## Task 8: 工具类静态页接入

**Files:**
- Modify: `e:\code\shao\pages\notice\notice.vue`（onShow L126-L133）
- Modify: `e:\code\shao\pages\points-record\points-record.vue`（onMounted L213-L228）
- Modify: `e:\code\shao\pages\redeem-record\redeem-record.vue`（onMounted/onShow 已导入）
- Modify: `e:\code\shao\pages\sign-in\sign-in.vue`（onMounted/onShow 已导入）
- Modify: `e:\code\shao\pages\tasks\tasks.vue`（onMounted 已导入）
- Modify: `e:\code\shao\pages\guide\guide.vue`（无生命周期，需加 onShow）
- Modify: `e:\code\shao\pages\forgot-password\forgot-password.vue`（无生命周期，需加 onShow）
- Modify: `e:\code\shao\pages\quiz\quiz.vue`（onMounted 已导入）
- Modify: `e:\code\shao\pages\quiz\practice.vue`（onLoad 已导入）
- Modify: `e:\code\shao\pages\quiz\exam\index.vue`（onShow 已导入）
- Modify: `e:\code\shao\pages\wrong-quiz\index.vue`（onMounted 已导入）

- [ ] **Step 1: 已导入生命周期页面接入（8 个）**

每个页面：import 追加 `import { setupPageShare } from '../../utils/share'`，在指定生命周期回调末尾追加对应调用：

| 页面 | 回调 | 代码 |
|---|---|---|
| notice.vue | onShow | `setupPageShare({ title: '消息通知' })` |
| points-record.vue | onMounted | `setupPageShare({ title: '积分明细' })` |
| redeem-record.vue | onMounted | `setupPageShare({ title: '兑换记录' })` |
| sign-in.vue | onMounted | `setupPageShare({ title: '每日签到' })` |
| tasks.vue | onMounted | `setupPageShare({ title: '任务中心' })` |
| quiz.vue | onMounted | `setupPageShare({ title: '答题中心' })` |
| quiz/practice.vue | onLoad | `setupPageShare({ title: '答题练习' })` |
| quiz/exam/index.vue | onShow | `setupPageShare({ title: '考试模式' })` |
| wrong-quiz/index.vue | onMounted | `setupPageShare({ title: '错题本' })` |

- [ ] **Step 2: 无生命周期页面补 onShow（guide、forgot-password）**

guide.vue 与 forgot-password.vue 各追加 import 与 onShow 回调：

```ts
import { onShow } from '@dcloudio/uni-app'
import { setupPageShare } from '../../utils/share'
// ...现有代码...
onShow(() => {
  setupPageShare({ title: '新手指引' })  // forgot-password.vue 用 '找回密码'
})
```

- [ ] **Step 3: Commit**

```bash
git add pages/notice/notice.vue pages/points-record/points-record.vue pages/redeem-record/redeem-record.vue pages/sign-in/sign-in.vue pages/tasks/tasks.vue pages/guide/guide.vue pages/forgot-password/forgot-password.vue pages/quiz/quiz.vue pages/quiz/practice.vue pages/quiz/exam/index.vue pages/wrong-quiz/index.vue
git commit -m "feat(shao): wechat share meta for tool/static pages"
```

---

## Task 9: 构建 + 验证

**Files:**
- 无源码改动

- [ ] **Step 1: 全局核对无遗漏**

Run: `grep -rn "setupPageShare" pages/`（或用 Grep 工具）——确认已接入 6 页 + 本计划 22 个新页面均有调用；`utils/share.ts` 内 `applySeoMeta` 已调用。统计 `pages/` 下所有 `.vue` 页面数对比。

- [ ] **Step 2: 构建 H5**

Run: `npm run build:h5`（在 `e:\code\shao`）
Expected: 构建成功，产物在 `dist/build/h5`

- [ ] **Step 3: 部署到 v.joho.cn**

Run: `powershell -File deploy-h5.ps1`（在 `e:\code\shao`），HostName=joho、站点 `/opt/1panel/apps/openresty/openresty/www/sites/v.joho.cn`，远程 rm/cp 需 sudo。
Expected: 部署完成，`index.html` 引用的 assets 文件名与本地 `dist/build/h5/index.html` 一致。

- [ ] **Step 4: 线上验证（微信内置浏览器）**

1. 微信打开 `https://v.joho.cn/#/pages/activity/detail?id=ubqfuuf1opxh0ogy6iv6rw2y`，右上角转发：卡片显示活动标题、描述、封面图。
2. 换一个无封面图的活动：卡片图回退租户 shareImage / 默认 share-image.png。
3. 打开 `https://v.joho.cn/#/pages/activity/list` 转发：显示「活动列表」+ 默认图。
4. 打开活动宣传页 `/#/pages/activity/promo?id=...` 转发：显示「活动标题｜活动宣传」。
5. 检查 `document.title` 与 `og:title/og:description/og:image` 随路由切换正确更新。

- [ ] **Step 5: Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "fix(shao): wechat share meta polish after verification"
```

---

## Self-Review 记录

- **Spec 覆盖**：meta 工具（Task 1）✓；share.ts 双保险（Task 2）✓；动态数据页 detail/promo/exchange/pickup（Task 3/4/5）✓；静态页全局补齐（Task 6/7/8）✓；兜底链由现有 setupPageShare/configShareWithInvite 保证（计划不改，Task 9 验证）✓；容错铁律（undefined 不传空串、resolveMediaUrl 绝对 URL）在 Task 1/2/3 代码中落实 ✓。
- **占位符扫描**：无 TBD/TODO；所有调用代码完整给出。
- **类型一致性**：`setupPageShare({ title, desc, imgUrl })` 签名与 share.ts `PageShareInput` 一致；`applySeoMeta(SeoMetaInput)` 与 Task 1 定义一致；`resolveActivityCover`/`setupActivityShare` 在 detail.vue 内定义并调用，无跨文件不一致。
