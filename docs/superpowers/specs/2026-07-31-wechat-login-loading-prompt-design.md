# 微信登录 loading 提示修复设计

> **日期**: 2026-07-31
> **状态**: 已批准，待实施
> **关联**: `2026-07-30-login-fallback-chain-and-invite-recovery-design.md`（登录降级链设计）

## 问题描述

### 现象

用户在微信环境打开注册链接 `http://v.joho.cn/#/pages/register/register?invitecode=3TF7O07E` 时，页面自动触发微信 OAuth 静默登录跳转，但跳转前和等待后端返回授权 URL 期间没有任何 loading 提示。用户看到完整渲染的注册表单后突然跳转走，体验空白、不友好。

### 根因

`redirectToWechatAuth()` 是异步函数（需先 POST 后端获取授权 URL，再 `window.location.href` 跳转），但在所有调用点均未显示 loading 提示。该函数自身也不包含任何 UI 反馈。

### 影响范围

以下 4 个调用点均缺少 loading 提示：

| 调用点 | 文件 | 行号 | 触发方式 |
|--------|------|------|----------|
| 注册页自动跳转 | `pages/register/register.vue` | 191-212 | onMounted 自动 |
| 全局自动跳转 | `App.vue` | 107-149 | onLaunch 自动 |
| 登录页自动跳转 | `pages/login/login.vue` | 483-521 | onMounted 自动（resolveWechatAutoLogin） |
| 登录页按钮触发 | `pages/login/login.vue` | 628-638 | 用户点击（h5WechatQuickLogin / h5WechatFullLogin） |
| 登录页微信图标触发 | `pages/login/login.vue` | 932-938 | 用户点击（wechatLogin 函数 H5 分支） |

对比：`pages/auth-callback/auth-callback.vue` 回调页有"微信登录中..."提示，但只在 OAuth 跳回后显示，不在发起跳转前显示。`wechatLogin` 函数的小程序分支（第 842 行）已有 `uni.showLoading({ title: '登录中...' })`，但 H5 分支无提示。

## 设计决策

### 方案选择：在 `redirectToWechatAuth` 内部统一封装

在 `utils/wx-h5-login.ts` 的 `redirectToWechatAuth` 函数内部统一封装 loading 提示和错误 toast，使其成为所有微信登录跳转的唯一入口。所有调用点自动获得 loading 提示，无需逐个修改。

**选择理由**：
- 单点修改，所有入口自动受益
- 调用点现有 catch 块的降级逻辑无需改动
- 符合"底层统一封装"的意图

### loading 生命周期

```
用户进入注册页（微信环境）
  │
  ├─ register.vue onMounted 检测到 third + 微信环境
  │    └─ 调用 redirectToWechatAuth('snsapi_base', state)
  │         │
  │         ├─ ① uni.showLoading({title: '微信登录中，请稍后...', mask: true})
  │         ├─ ② POST 后端获取 authUrl（等待期间 loading 持续显示）
  │         ├─ ③ 成功：window.location.href = authUrl（页面跳转，loading 自然消失）
  │         └─ ③ 失败：hideLoading + showToast('微信登录跳转失败') + rethrow
  │              └─ 调用点 catch 块：降级显示本地注册/登录表单
```

**关键设计决策**：
- `mask: true` 阻止用户在等待期间重复操作
- 成功时不主动 `hideLoading`——页面跳转会自然销毁 loading DOM
- 失败时 rethrow 错误，让调用点的 catch 块执行各自的降级逻辑

## 文件变更明细

### 1. `utils/wx-h5-login.ts` — `redirectToWechatAuth` 函数（核心修改）

在函数入口添加 `uni.showLoading`，用 try/catch 包裹现有逻辑，catch 中 `hideLoading` + `showToast` + rethrow：

```typescript
export async function redirectToWechatAuth(scope: string = 'snsapi_base', state?: string): Promise<void> {
  // 显示 loading（mask 阻止用户重复操作）
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

### 2. `pages/login/login.vue` — 补充 fire-and-forget 调用的 catch（小修改）

`h5WechatQuickLogin` 和 `h5WechatFullLogin` 当前是 fire-and-forget（无 await、无 catch），rethrow 后会产生未捕获 Promise 拒绝。补充 try/catch：

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

#### wechatLogin 函数 H5 分支（补 catch）

`wechatLogin` 是同步函数（含小程序回调逻辑，不宜整体改 async），其 H5 分支第 934 行的 fire-and-forget 调用需加 `.catch()` 防止未捕获 Promise 拒绝：

```typescript
// wechatLogin 函数内，原第 932-938 行
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

### 无需修改的文件

以下调用点的现有 catch 块已正确处理降级，无需改动：

| 文件 | 现有 catch 行为 | 降级结果 |
|------|-----------------|----------|
| `register.vue` 第 207-210 行 | 清除 TTL 标记 + 显示注册表单 | 用户看到表单可本地注册 |
| `App.vue` 第 138-142 行 | 清除 TTL 标记 | 用户留在当前页，auth 守卫按需跳登录 |
| `login.vue` `resolveWechatAutoLogin` 第 502-505 行 | return false | 登录降级链继续，显示本地表单 |

## 错误处理与降级链

### 错误处理分层

```
redirectToWechatAuth 内部（第一层）
  ├─ 网络错误 / 后端 500 / 无 authUrl
  │    └─ hideLoading + showToast('微信登录跳转失败，请重试') + rethrow
  │
  └─ 调用点 catch（第二层，各自降级）
       ├─ register.vue → 显示注册表单（本地注册）
       ├─ App.vue → 留在当前页（auth 守卫按需跳登录）
       ├─ login.vue resolveWechatAutoLogin → return false → 降级链继续
       ├─ login.vue h5WechatQuickLogin/FullLogin → 表单已可见，无需额外处理
       └─ login.vue wechatLogin H5 分支 → 表单已可见，无需额外处理
```

### 与已有降级链设计的关系

项目中 `2026-07-30-login-fallback-chain-and-invite-recovery-design.md` 定义了 third→SSO→local 降级链。本次修复不改变降级链结构，只在 third 微信跳转失败时增加用户提示，降级行为完全复用现有 catch 块。

### 边界情况处理

- **重复触发**：各调用点已有防循环机制（5 分钟 TTL + URL code 检测），loading 的 `mask: true` 额外阻止用户在等待期间重复点击
- **loading 残留**：成功跳转时 loading 随页面卸载自然消失；失败时 `hideLoading` 主动清除
- **toast 与 loading 冲突**：uni-app 中 `showToast` 会自动关闭 `showLoading`，但为保险先 `hideLoading` 再 `showToast`

## 测试验证

### 验证方式

由于微信 OAuth 需要真实微信公众号环境，主要通过以下方式验证：

1. **本地模拟**：URL 加 `?debugWx=1` 参数（`utils/env.ts` 已实现），`isWechatBrowser()` 返回 true，可端到端模拟微信环境
2. **断网测试**：在 `redirectToWechatAuth` 等待 POST 期间断网，验证 loading 显示后变为 toast 提示 + 降级表单
3. **后端异常测试**：后端返回空 authUrl，验证 throw → catch → toast → 降级链
4. **各入口覆盖**：
   - 注册页：`/#/pages/register/register?invitecode=3TF7O07E&debugWx=1`
   - 登录页：`/#/pages/login/login?debugWx=1`
   - 全局：`/#/pages/index/index?debugWx=1`（未登录状态）

### 验证标准

- 进入页面后立即看到"微信登录中，请稍后..."loading 遮罩
- 等待期间页面不可交互（mask 生效）
- 成功时 loading 持续到页面跳转
- 失败时 loading 消失，出现 toast，随后显示本地注册/登录表单

## 改动文件清单

| 文件 | 改动类型 | 改动量 |
|------|----------|--------|
| `utils/wx-h5-login.ts` | 修改 `redirectToWechatAuth` 函数 | 约 +10 行（try/catch + showLoading/toast） |
| `pages/login/login.vue` | 修改 `h5WechatQuickLogin` / `h5WechatFullLogin` / `wechatLogin` H5 分支 | 约 +12 行（补充 try/catch 与 .catch） |
