# 微信登录 loading 提示修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在微信环境发起 OAuth 登录跳转时显示"微信登录中，请稍后..."loading 提示，失败时 toast 提示并降级到本地登录表单。

**Architecture:** 在 `utils/wx-h5-login.ts` 的 `redirectToWechatAuth` 函数内部统一封装 `uni.showLoading` + `uni.showToast`，所有调用点自动获得提示。调用点的 fire-and-forget 调用补充 try/catch 或 .catch() 防止未捕获 Promise 拒绝，现有 catch 块的降级逻辑不变。

**Tech Stack:** uni-app + Vue3 + TypeScript，H5 微信公众号 OAuth 登录，`uni.showLoading` / `uni.showToast` 原生 API。

**关联设计:** `docs/superpowers/specs/2026-07-31-wechat-login-loading-prompt-design.md`

**验证说明:** 项目无单元测试框架，采用"构建检查（`npm run build:h5`）+ 手动浏览器验证（`?debugWx=1` 模拟微信环境）"替代 TDD。

---

## 文件结构

| 文件 | 职责 | 改动 |
|------|------|------|
| `utils/wx-h5-login.ts` | H5 微信公众号登录工具，`redirectToWechatAuth` 发起 OAuth 跳转 | 修改 `redirectToWechatAuth` 函数，加 loading/toast |
| `pages/login/login.vue` | 登录页，含多个微信登录入口 | 修改 3 个 fire-and-forget 调用点，补 catch |

**不修改的文件**（现有 catch 块已正确降级）：
- `pages/register/register.vue` — 第 206-210 行已有 try/catch，降级显示注册表单
- `App.vue` — 第 136-142 行已有 .then().catch()，降级留在当前页
- `pages/login/login.vue` 的 `resolveWechatAutoLogin` — 第 498-505 行已有 try/catch，降级 return false

---

### Task 1: 修改 `redirectToWechatAuth` 函数加 loading 提示

**Files:**
- Modify: `utils/wx-h5-login.ts:31-56`

- [ ] **Step 1: 读取当前函数确认内容**

Run: 用编辑工具读取 `utils/wx-h5-login.ts` 第 31-56 行，确认当前内容如下（用于精确匹配 SEARCH 段）：

```typescript
export async function redirectToWechatAuth(scope: string = 'snsapi_base', state?: string): Promise<void> {
  uni.setStorageSync('wxAuthScope', scope)
  uni.setStorageSync('wxAuthAppType', 'official_account')

  const baseUrl = window.location.origin
  const redirectUri = `${baseUrl}/api/zhao-third/v1/wechat/callback`

  const finalState = state || getCurrentPagePath()

  const res = await request(`/zhao-third/v1/third/auth-url?domain=${encodeURIComponent(SITE_DOMAIN)}`, {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'official_account',
      redirectUrl: redirectUri,
      scope,
      state: finalState,
    }
  }) as any

  const authUrl = res.authUrl || res.url
  if (!authUrl) {
    throw new Error('未获取到微信授权 URL')
  }
  window.location.href = authUrl
}
```

- [ ] **Step 2: 替换函数，加 showLoading + try/catch + showToast**

将上面整段函数替换为：

```typescript
export async function redirectToWechatAuth(scope: string = 'snsapi_base', state?: string): Promise<void> {
  // 显示 loading（mask 阻止用户重复操作），跳转成功后页面卸载自然消失
  uni.showLoading({ title: '微信登录中，请稍后...', mask: true })

  try {
    uni.setStorageSync('wxAuthScope', scope)
    uni.setStorageSync('wxAuthAppType', 'official_account')

    const baseUrl = window.location.origin
    const redirectUri = `${baseUrl}/api/zhao-third/v1/wechat/callback`

    const finalState = state || getCurrentPagePath()

    const res = await request(`/zhao-third/v1/third/auth-url?domain=${encodeURIComponent(SITE_DOMAIN)}`, {
      method: 'POST',
      data: {
        platform: 'wechat',
        appType: 'official_account',
        redirectUrl: redirectUri,
        scope,
        state: finalState,
      }
    }) as any

    const authUrl = res.authUrl || res.url
    if (!authUrl) {
      throw new Error('未获取到微信授权 URL')
    }
    // 成功：不 hideLoading，页面跳转自然销毁 loading
    window.location.href = authUrl
  } catch (error) {
    // 失败：隐藏 loading + 提示 + rethrow 让调用方降级
    uni.hideLoading()
    uni.showToast({ title: '微信登录跳转失败，请重试', icon: 'none', duration: 2000 })
    throw error
  }
}
```

- [ ] **Step 3: 构建检查确认无编译错误**

Run: `npm run build:h5`（在 `d:\zhao\strapi-course` 目录）
Expected: 构建成功，无 TypeScript / 编译错误。若报错，检查 `uni.showLoading` / `uni.hideLoading` / `uni.showToast` 是否被 uni-app 类型识别（这些是 uni 全局 API，无需 import）。

- [ ] **Step 4: 提交**

```bash
cd d:\zhao\strapi-course
git add utils/wx-h5-login.ts
git commit -m "fix: 微信登录跳转增加 loading 提示与失败 toast"
```

---

### Task 2: 修改 login.vue 三个 fire-and-forget 调用点

`redirectToWechatAuth` 现在 rethrow 错误，login.vue 中 3 个 fire-and-forget 调用点需补 catch 防止未捕获 Promise 拒绝。

**Files:**
- Modify: `pages/login/login.vue:628-638`（h5WechatQuickLogin / h5WechatFullLogin）
- Modify: `pages/login/login.vue:932-938`（wechatLogin 函数 H5 分支）

- [ ] **Step 1: 修改 h5WechatQuickLogin 函数**

读取 `pages/login/login.vue` 第 628-632 行，确认当前内容：

```typescript
function h5WechatQuickLogin() {
  // #ifdef H5
  redirectToWechatAuth('snsapi_base')
  // #endif
}
```

替换为：

```typescript
async function h5WechatQuickLogin() {
  // #ifdef H5
  try {
    await redirectToWechatAuth('snsapi_base')
  } catch {
    // toast 已由 redirectToWechatAuth 内部处理
  }
  // #endif
}
```

- [ ] **Step 2: 修改 h5WechatFullLogin 函数**

读取第 634-638 行，确认当前内容：

```typescript
function h5WechatFullLogin() {
  // #ifdef H5
  redirectToWechatAuth('snsapi_userinfo')
  // #endif
}
```

替换为：

```typescript
async function h5WechatFullLogin() {
  // #ifdef H5
  try {
    await redirectToWechatAuth('snsapi_userinfo')
  } catch {
    // toast 已由 redirectToWechatAuth 内部处理
  }
  // #endif
}
```

- [ ] **Step 3: 修改 wechatLogin 函数 H5 分支**

读取第 932-938 行，确认当前内容（注意 `wechatLogin` 是同步函数，含小程序回调，不改 async，用 .catch()）：

```typescript
  // #ifdef H5
  if (isWechatBrowser()) {
    redirectToWechatAuth('snsapi_base')
    return
  }
  uni.showToast({ title: '请在微信中打开', icon: 'none' })
  // #endif
```

替换为：

```typescript
  // #ifdef H5
  if (isWechatBrowser()) {
    redirectToWechatAuth('snsapi_base').catch(() => {
      // toast 已由 redirectToWechatAuth 内部处理
    })
    return
  }
  uni.showToast({ title: '请在微信中打开', icon: 'none' })
  // #endif
```

- [ ] **Step 4: 构建检查确认无编译错误**

Run: `npm run build:h5`（在 `d:\zhao\strapi-course` 目录）
Expected: 构建成功。注意 `h5WechatQuickLogin` / `h5WechatFullLogin` 改为 `async` 后，template 中的 `@click="h5WechatQuickLogin"` / `@click="h5WechatFullLogin"` 调用不受影响（Vue 事件绑定兼容 async 函数）。

- [ ] **Step 5: 提交**

```bash
cd d:\zhao\strapi-course
git add pages/login/login.vue
git commit -m "fix: login.vue 微信登录调用点补充 catch 防未捕获拒绝"
```

---

### Task 3: 手动验证各入口

**Files:**
- 验证: 浏览器访问 H5 dev server

- [ ] **Step 1: 启动 H5 dev server**

Run: `npm run dev:h5`（在 `d:\zhao\strapi-course` 目录，非阻塞运行）
Expected: dev server 启动，输出本地访问地址（通常 `http://localhost:5173` 或类似）。

- [ ] **Step 2: 验证注册页 loading 提示（主场景）**

浏览器访问：`http://localhost:<port>/#/pages/register/register?invitecode=3TF7O07E&debugWx=1`

Expected:
- 页面立即显示"微信登录中，请稍后..."loading 遮罩（mask 生效，页面不可点击）
- 因本地无真实微信公众号配置，后端 `/zhao-third/v1/third/auth-url` 会返回错误或空
- loading 消失，出现"微信登录跳转失败，请重试"toast
- toast 消失后显示本地注册表单（降级成功）

若 loading 未显示：检查 `register.vue` 第 191 行条件 `isWechatBrowser() && authConfig?.mode === 'third' && authConfig?.wechatOfficialAccountEnabled` 是否满足（`debugWx=1` 使 `isWechatBrowser()` 返回 true，但 authConfig 需后端返回 third 模式 + 公众号启用）。

- [ ] **Step 3: 验证登录页 loading 提示**

浏览器访问：`http://localhost:<port>/#/pages/login/login?debugWx=1`

Expected:
- 若自动跳转分支触发：同 Step 2，显示 loading → toast → 本地登录表单
- 若显示登录表单：点击"微信快速登录"按钮，应显示 loading → toast（因无真实公众号配置）

- [ ] **Step 4: 验证全局入口（未登录状态）**

清除 localStorage 中的 token，访问：`http://localhost:<port>/#/pages/index/index?debugWx=1`

Expected:
- App.vue onLaunch 检测微信环境 + 未登录 → 显示 loading → 失败 toast → 留在首页（auth 守卫按需跳登录）

- [ ] **Step 5: 验证成功路径（如有真实公众号配置）**

若后端已配置真实微信公众号：
- 访问注册链接，显示 loading → 跳转微信授权页 → 授权后回到 auth-callback 页（显示"微信登录中..."）→ 登录成功跳首页
- loading 在跳转期间持续显示，无空白体验

若无可跳过此步。

- [ ] **Step 6: 提交验证记录（可选）**

若验证中发现问题并修复，提交修复：

```bash
cd d:\zhao\strapi-course
git add -A
git commit -m "fix: 验证修复"
```

若无问题，无需提交，Task 1-2 的提交已是最终代码。

---

## Self-Review 结果

**1. Spec coverage:**
- ✅ `redirectToWechatAuth` 加 loading/toast → Task 1
- ✅ register.vue 调用点 → 无需修改（现有 catch 降级），Task 3 Step 2 验证
- ✅ App.vue 调用点 → 无需修改（现有 .catch 降级），Task 3 Step 4 验证
- ✅ login.vue resolveWechatAutoLogin → 无需修改（现有 catch 降级），Task 3 Step 3 验证
- ✅ login.vue h5WechatQuickLogin/h5WechatFullLogin → Task 2 Step 1-2
- ✅ login.vue wechatLogin H5 分支 → Task 2 Step 3
- ✅ 失败降级到本地登录 → 现有 catch 块复用，Task 3 验证

**2. Placeholder scan:** 无 TBD/TODO，所有代码块完整。

**3. Type consistency:** `redirectToWechatAuth` 签名不变 `(scope, state?) => Promise<void>`，rethrow 保持 Promise<void>。`h5WechatQuickLogin`/`h5WechatFullLogin` 从同步改 async，返回值从 void 变 Promise<void>，Vue @click 兼容。
