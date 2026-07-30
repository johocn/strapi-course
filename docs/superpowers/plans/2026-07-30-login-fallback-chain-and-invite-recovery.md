# 登录降级链与邀请码兜底实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 strapi-course 前端登录降级链（三方 → SSO → 本地），微信环境自动跳微信，auth-callback 兜底建立分销关系

**Architecture:** 前端降级链决策器（resolveLoginChain）+ 统一邀请码兜底函数（bindInviteCodesAfterLogin）+ auth-callback 双路径兜底（SSO + third）

**Tech Stack:** Vue 3 + uni-app + TypeScript + existing zhao-channel API（useInviteCode / joinChannelByInvite）

**Spec:** [2026-07-30-login-fallback-chain-and-invite-recovery-design.md](file:///d:/zhao/strapi-course/docs/specs/2026-07-30-login-fallback-chain-and-invite-recovery-design.md)

**测试方式:** 手动测试（项目无自动化测试框架），使用 `?debugWx=1` 模拟微信环境，浏览器 storage 面板设置邀请码

---

## 文件结构

| 文件 | 责任 | 操作 |
|------|------|------|
| [utils/invite.ts](file:///d:/zhao/strapi-course/utils/invite.ts) | 统一邀请码兜底函数 | 新增 `bindInviteCodesAfterLogin()` |
| [pages/login/login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) | 登录降级链决策 | 新增 `resolveLoginChain()` / `resolveWechatAutoLogin()`，重构 onMounted，替换现有 `bindInviteCodesAfterLogin` |
| [pages/auth-callback/auth-callback.vue](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) | 回调兜底分销关系 | 新增 `bindInviteCodesAfterCallback()`，SSO 路径和 third 路径都调用 |
| [pages/register/register.vue](file:///d:/zhao/strapi-course/pages/register/register.vue) | 注册表单空值回退 | 修正 inviteCode 空值回退 storage |

---

## Task 1: 新增统一邀请码兜底函数

**Files:**
- Modify: `d:\zhao\strapi-course\utils\invite.ts`

- [ ] **Step 1: 在 utils/invite.ts 末尾新增 bindInviteCodesAfterLogin 函数**

读取 [utils/invite.ts](file:///d:/zhao/strapi-course/utils/invite.ts) 当前内容，在文件末尾新增：

```typescript
// ==================== 邀请码兜底绑定 ====================

/**
 * 登录/回调成功后兜底建立分销关系
 * - inviteCode（用户邀请码，来自 v.joho.cn）→ useInviteCode（/user-invites/use）
 * - channelInviteCode（渠道邀请码，来自 h.joho.cn）→ joinChannelByInvite（/channel-invite/join，幂等）
 *
 * 调用方：
 * - login.vue 本地登录成功后
 * - auth-callback.vue SSO/third 回调成功后
 *
 * 策略：成功才清除 storage，失败保留下次再试
 */
export async function bindInviteCodesAfterLogin(): Promise<void> {
  const inviteCode = uni.getStorageSync('inviteCode') || ''
  const channelInviteCode = uni.getStorageSync('channelInviteCode') || ''

  // 用户邀请码 → useInviteCode
  if (inviteCode) {
    try {
      const { useInviteCode } = await import('../services/api')
      await useInviteCode(inviteCode)
      uni.removeStorageSync('inviteCode')
      console.log('[invite] 用户邀请码绑定成功:', inviteCode)
    } catch (e) {
      console.warn('[invite] 绑定用户邀请码失败，保留 storage:', e)
    }
  }

  // 渠道邀请码 → joinChannelByInvite（后端幂等，已存在则返回 isNewMember: false）
  if (channelInviteCode) {
    try {
      const { joinChannelByInvite } = await import('../services/api')
      await joinChannelByInvite(channelInviteCode)
      uni.removeStorageSync('channelInviteCode')
      console.log('[invite] 渠道邀请码绑定成功:', channelInviteCode)
    } catch (e) {
      console.warn('[invite] 加入渠道失败，保留 storage:', e)
    }
  }
}
```

- [ ] **Step 2: 验证文件无语法错误**

Run: `cd d:\zhao\strapi-course && npx tsc --noEmit utils/invite.ts 2>&1 | head -20`
Expected: 无错误或仅有类型解析警告（uni 全局变量）

- [ ] **Step 3: Commit**

```bash
cd d:\zhao\strapi-course
git add utils/invite.ts
git commit -m "feat(invite): 新增 bindInviteCodesAfterLogin 统一兜底函数"
```

---

## Task 2: 修改 login.vue 使用统一兜底函数

**Files:**
- Modify: `d:\zhao\strapi-course\pages\login\login.vue` (行 681, 745-785)

- [ ] **Step 1: 替换 login.vue 中的 bindInviteCodesAfterLogin 函数**

定位到 [login.vue:745-785](file:///d:/zhao/strapi-course/pages/login/login.vue) 现有的 `bindInviteCodesAfterLogin` 函数，整个函数替换为：

```typescript
// === 绑定邀请码（调用统一兜底函数） ===
async function bindInviteCodesAfterLogin() {
  const { bindInviteCodesAfterLogin: doBind } = await import('../../utils/invite')
  await doBind()
}
```

- [ ] **Step 2: 确认 import 路径正确**

验证 [login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) 顶部是否已有 services/api 的 import。如果没有，确认 `useInviteCode` 和 `joinChannelByInvite` 已在文件中导入（原有代码已在使用，应已导入）。

- [ ] **Step 3: 手动测试本地登录邀请码绑定**

1. 浏览器打开登录页
2. storage 面板设置 `inviteCode=test123` 和 `channelInviteCode=chan456`
3. 使用本地账号密码登录
4. 预期：控制台输出 `[invite] 用户邀请码绑定成功` 和 `[invite] 渠道邀请码绑定成功`
5. 预期：storage 中 inviteCode 和 channelInviteCode 被清除

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/login/login.vue
git commit -m "refactor(login): 使用统一兜底函数替代本地 bindInviteCodesAfterLogin"
```

---

## Task 3: auth-callback.vue 新增兜底逻辑

**Files:**
- Modify: `d:\zhao\strapi-course\pages\auth-callback\auth-callback.vue`

- [ ] **Step 1: 新增 bindInviteCodesAfterCallback 函数**

在 [auth-callback.vue](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 的 `handleOAuthCallback` 函数之前，新增：

```typescript
// === 兜底建立分销关系（SSO 路径 + third 路径共用） ===
async function bindInviteCodesAfterCallback() {
  const { bindInviteCodesAfterLogin } = await import('../../utils/invite')
  await bindInviteCodesAfterLogin()
}
```

- [ ] **Step 2: 修改 SSO 路径（token 参数）的 storage 清理逻辑**

定位到 [auth-callback.vue:65-103](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) SSO 路径（`if (token)` 分支）。

原代码（行 84-89）：
```typescript
window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
uni.removeStorageSync('wxAuthScope')
uni.removeStorageSync('wxAuthAppType')
uni.removeStorageSync('inviteCode')
uni.removeStorageSync('channelInviteCode')
uni.removeStorageSync('h5AutoLoginAttemptedAt')
```

替换为：
```typescript
window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
// 兜底建立分销关系（成功才清除 inviteCode/channelInviteCode，失败保留下次再试）
await bindInviteCodesAfterCallback()
// 清理无关 storage（非邀请码）
uni.removeStorageSync('wxAuthScope')
uni.removeStorageSync('wxAuthAppType')
uni.removeStorageSync('h5AutoLoginAttemptedAt')
```

- [ ] **Step 3: 修改 third 路径（code 参数）的 storage 清理逻辑**

定位到 [auth-callback.vue:133-161](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) third 路径（`callbackToken` 分支）。

原代码（行 143-148）：
```typescript
window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
uni.removeStorageSync('wxAuthScope')
uni.removeStorageSync('wxAuthAppType')
uni.removeStorageSync('inviteCode')
uni.removeStorageSync('channelInviteCode')
uni.removeStorageSync('h5AutoLoginAttemptedAt')
```

替换为：
```typescript
window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])
// 兜底建立分销关系（覆盖后端 createForUser 失败/老用户不处理/channelInviteCode 丢弃）
await bindInviteCodesAfterCallback()
// 清理无关 storage（非邀请码）
uni.removeStorageSync('wxAuthScope')
uni.removeStorageSync('wxAuthAppType')
uni.removeStorageSync('h5AutoLoginAttemptedAt')
```

- [ ] **Step 4: 手动测试 SSO 路径兜底**

1. storage 面板设置 `inviteCode=test123` 和 `channelInviteCode=chan456`
2. 模拟 SSO 回调：浏览器访问 `/#/pages/auth-callback/auth-callback?token=fake_token&user=eyJpZCI6MX0=`（base64 编码的 `{"id":1}`）
3. 预期：控制台输出兜底绑定日志
4. 预期：storage 中 inviteCode 和 channelInviteCode 被清除（或失败时保留）
5. 预期：wxAuthScope/wxAuthAppType/h5AutoLoginAttemptedAt 被清除

- [ ] **Step 5: 手动测试 third 路径兜底**

1. storage 面板设置 `inviteCode=test123` 和 `channelInviteCode=chan456`
2. 模拟 third 回调：浏览器访问 `/#/pages/auth-callback/auth-callback?code=fake_code`
3. 预期：调用 /zhao-third/v1/third/callback（会失败，但兜底逻辑应在 try/catch 中执行）
4. 注：此测试需后端运行，实际验证需在完整环境

- [ ] **Step 6: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/auth-callback/auth-callback.vue
git commit -m "feat(auth-callback): 新增 SSO/third 双路径邀请码兜底逻辑"
```

---

## Task 4: register.vue 表单 inviteCode 空值回退

**Files:**
- Modify: `d:\zhao\strapi-course\pages\register\register.vue` (行 199-205)

- [ ] **Step 1: 修正 register 接口调用的 inviteCode 参数**

定位到 [register.vue:199-205](file:///d:/zhao/strapi-course/pages/register/register.vue)。

原代码：
```typescript
const res = await register({
  username: registerForm.value.username,
  email: registerForm.value.email,
  password: registerForm.value.password,
  inviteCode: registerForm.value.inviteCode ?? undefined,
  channelInviteCode: uni.getStorageSync('channelInviteCode') || undefined
})
```

替换为：
```typescript
const res = await register({
  username: registerForm.value.username,
  email: registerForm.value.email,
  password: registerForm.value.password,
  // 表单优先（用户可编辑），表单空则回退 storage（防止用户清空表单丢失邀请码）
  inviteCode: registerForm.value.inviteCode || uni.getStorageSync('inviteCode') || undefined,
  // 渠道码始终从 storage 取（不在表单展示）
  channelInviteCode: uni.getStorageSync('channelInviteCode') || undefined
})
```

- [ ] **Step 2: 确认注册成功后的 storage 清理逻辑**

验证 [register.vue:215](file:///d:/zhao/strapi-course/pages/register/register.vue) 已有 `uni.removeStorageSync('channelInviteCode')`。

在 `uni.removeStorageSync('channelInviteCode')` 之后新增一行：
```typescript
uni.removeStorageSync('inviteCode')
```

- [ ] **Step 3: 手动测试表单空值回退**

1. storage 面板设置 `inviteCode=storage123`
2. 打开注册页，表单 inviteCode 字段会自动填入 storage 值
3. 手动清空表单 inviteCode 字段
4. 填写其他注册信息，提交注册
5. 预期：注册接口请求体中 inviteCode = 'storage123'（回退 storage）

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/register/register.vue
git commit -m "fix(register): inviteCode 表单空值回退 storage 防丢失"
```

---

## Task 5: login.vue 新增降级链决策函数

**Files:**
- Modify: `d:\zhao\strapi-course\pages\login\login.vue`

- [ ] **Step 1: 新增 resolveLoginChain 决策函数**

在 [login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) 的 `onMounted` 之前，新增降级链决策函数：

```typescript
// === 降级链决策：返回有序的可用登录方式 ===
interface LoginOption {
  key: 'wechat-mp' | 'wechat-h5' | 'wechat-pc' | 'sso' | 'local'
  priority: number      // 1=最高
  autoTrigger: boolean  // 是否自动触发（无需用户点击）
  available: boolean
}

function resolveLoginChain(): LoginOption[] {
  const options: LoginOption[] = []
  const mode = authConfig.value?.mode || 'local'
  const ssoLoginUrl = authConfig.value?.ssoLoginUrl || ''
  const wechatOfficialAccountEnabled = authConfig.value?.wechatOfficialAccountEnabled
  const wechatOpenPlatformEnabled = authConfig.value?.wechatOpenPlatformEnabled
  const wechatMiniProgramEnabled = authConfig.value?.wechatMiniProgramEnabled

  // #ifdef MP-WEIXIN
  // 微信小程序：third 可用 → silentLogin
  if (mode === 'third' && wechatMiniProgramEnabled) {
    options.push({ key: 'wechat-mp', priority: 1, autoTrigger: true, available: true })
  }
  // #endif

  // #ifdef H5
  // H5 微信浏览器：third 可用 + 公众号 → snsapi_base 自动跳
  if (isWechatBrowser() && mode === 'third' && wechatOfficialAccountEnabled) {
    options.push({ key: 'wechat-h5', priority: 1, autoTrigger: true, available: true })
  }
  // H5 微信浏览器：third 不可用 + SSO 可用 → 自动跳 SSO（SSO 后端再跳微信）
  if (isWechatBrowser() && !wechatOfficialAccountEnabled && ssoLoginUrl) {
    options.push({ key: 'sso', priority: 1, autoTrigger: true, available: true })
  }
  // H5 非微信浏览器：third 可用 + 开放平台 → PC 扫码
  if (!isWechatBrowser() && mode === 'third' && wechatOpenPlatformEnabled) {
    options.push({ key: 'wechat-pc', priority: 1, autoTrigger: false, available: true })
  }
  // H5 非微信浏览器：third 不可用 + SSO 可用 → SSO 入口
  if (!isWechatBrowser() && mode !== 'third' && ssoLoginUrl) {
    options.push({ key: 'sso', priority: 2, autoTrigger: false, available: true })
  }
  // #endif

  // 兜底：本地表单（优先级最低）
  options.push({ key: 'local', priority: 99, autoTrigger: false, available: true })

  // 按优先级排序
  return options.sort((a, b) => a.priority - b.priority)
}
```

- [ ] **Step 2: 新增 resolveWechatAutoLogin 函数**

在 `resolveLoginChain` 之后新增：

```typescript
// === 微信环境自动登录决策（优先级高于 mode） ===
async function resolveWechatAutoLogin(): Promise<boolean> {
  // #ifdef H5
  if (!isWechatBrowser()) return false

  const mode = authConfig.value?.mode || 'local'
  const wechatOfficialAccountEnabled = authConfig.value?.wechatOfficialAccountEnabled
  const ssoLoginUrl = authConfig.value?.ssoLoginUrl

  // 三方优先：直接跳微信
  if (mode === 'third' && wechatOfficialAccountEnabled) {
    redirectToWechatAuth('snsapi_base')
    return true
  }

  // 降级 SSO：SSO 后端再跳微信
  if (!wechatOfficialAccountEnabled && ssoLoginUrl) {
    redirectToSso()
    return true
  }

  // 都不可用 → 显示本地表单 + 微信按钮
  return false
  // #endif

  // #ifndef H5
  return false
  // #endif
}
```

- [ ] **Step 3: 重构 onMounted 自动跳转逻辑**

定位到 [login.vue:529-533](file:///d:/zhao/strapi-course/pages/login/login.vue) 现有的 SSO 自动跳转代码：

```typescript
// SSO 模式 + 微信环境 → 自动跳转 SSO 登录页（无需用户点击）
if (isWechatBrowser() && authConfig.value?.mode === 'sso' && authConfig.value?.ssoLoginUrl) {
  redirectToSso()
  return
}
```

替换为：
```typescript
// 微信环境自动跳转（降级链决策，优先级高于 mode）
if (await resolveWechatAutoLogin()) {
  return
}
```

- [ ] **Step 4: 手动测试降级链决策（场景 1-7）**

按 spec 测试场景逐项验证：

1. **场景 2**：H5 + `?debugWx=1` + third 模式 → 自动跳微信
2. **场景 3**：H5 + `?debugWx=1` + SSO 模式（third 不可用）→ 自动跳 SSO
3. **场景 4**：H5 + `?debugWx=1` + local 模式 → 显示本地表单
4. **场景 5**：PC + third + 开放平台 → 显示扫码入口
5. **场景 6**：PC + SSO（third 不可用）→ 显示 SSO 入口
6. **场景 7**：PC + local → 显示本地表单

- [ ] **Step 5: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/login/login.vue
git commit -m "feat(login): 新增降级链决策 resolveLoginChain + 微信环境自动跳转"
```

---

## Task 6: 端到端手动测试与回归验证

**Files:**
- 无文件改动，仅测试验证

- [ ] **Step 1: 验证 C 端带邀请码注册流程**

测试链接：`http://v.joho.cn/#/pages/register/register?invitecode=3TF7O07E`

1. 访问带 invitecode 的注册链接
2. 验证 storage 中 inviteCode 和 channelInviteCode 已写入
3. 完成本地注册
4. 验证后端建立分销关系（检查用户邀请码列表）
5. 验证 storage 中 inviteCode 和 channelInviteCode 已清除

- [ ] **Step 2: 验证三方登录带邀请码流程**

1. storage 面板设置 `inviteCode=test123` 和 `channelInviteCode=chan456`
2. 触发三方登录（微信环境模拟）
3. 回调到 auth-callback
4. 验证兜底调用 useInviteCode 和 joinChannelByInvite
5. 验证 storage 清除（成功时）

- [ ] **Step 3: 验证 SSO 登录带邀请码流程**

1. storage 面板设置 `inviteCode=test123` 和 `channelInviteCode=chan456`
2. 触发 SSO 登录跳转
3. 回调到 auth-callback（token 参数）
4. 验证兜底调用 useInviteCode 和 joinChannelByInvite
5. 验证 storage 清除（成功时）

- [ ] **Step 4: 验证兜底失败保留 storage**

1. 模拟 useInviteCode 接口失败（断网或后端停服）
2. 触发登录
3. 验证 storage 中 inviteCode 保留
4. 恢复网络，重新登录
5. 验证兜底再次尝试并成功清除

- [ ] **Step 5: 验证防循环跳转**

1. SSO 回跳 auth-callback 后，确认不再触发 redirectToSso
2. 微信回调带 code 参数时，确认不触发 snsapi_base 自动跳转
3. 5 分钟内重复访问登录页，确认不重复跳转

- [ ] **Step 6: 验证现有功能不回归**

1. 无邀请码直接登录 → 正常
2. 后台 `h.joho.cn/?code=xxx` → 走 strapi-backend 现有逻辑（不改动）
3. 微信小程序 silentLogin → 正常
4. PC 扫码登录 → 正常

- [ ] **Step 7: 生成测试报告**

记录所有测试场景的结果，标注通过/失败项。

---

## Self-Review

### Spec 覆盖检查

| Spec 章节 | 对应 Task | 覆盖状态 |
|-----------|-----------|----------|
| 1. 降级链决策树 | Task 5 | ✅ |
| 2. resolveLoginChain 函数 | Task 5 | ✅ |
| 3. 替换互斥分支 | Task 5 | ⚠️ 部分（保留现有模板，仅改 onMounted 决策） |
| 4. 微信环境覆盖 | Task 5 | ✅ |
| 5. 小程序环境 | Task 5 | ✅（保持现状） |
| 6. 防 SSO 循环 | Task 6 Step 5 | ✅（继承现有检查） |
| 7. auth-callback 兜底 | Task 3 | ✅ |
| 8. 统一兜底函数 | Task 1 | ✅ |
| 9. register.vue 空值回退 | Task 4 | ✅ |
| 10. 本地注册后处理 | Task 4 Step 2 | ✅ |

### 遗漏项

- **Task 5 Step 3**：spec 说"模板改为主入口+备选列表"，但本计划仅改 onMounted 决策逻辑，未改模板渲染。理由：现有模板的 5 个 v-if 分支已能渲染所有可用入口，改模板风险大。降级链主要体现在 onMounted 的自动跳转决策上，模板渲染保持现状。

### 待验证项（实施阶段）

- `useInviteCode` 的幂等性：[user-invite.ts:123](file:///d:/zhao/strapi/plugins/zhao-channel/server/src/controllers/user-invite.ts) `service.useInvite(code, userId)` 是否检查已使用
- Task 5 Step 4 场景 1（微信小程序）需小程序环境，手动测试可能受限

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-login-fallback-chain-and-invite-recovery.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
