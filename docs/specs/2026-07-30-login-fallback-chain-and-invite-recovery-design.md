# 登录降级链与邀请码兜底设计

**日期**: 2026-07-30
**范围**: strapi-course 前端（C 端）
**状态**: 待实施

## 与历史设计的关系

本设计 **继承** 以下已实施的历史设计，不重复设计这些部分：

| 历史设计 | 已实施内容 | 本设计关系 |
|---------|-----------|-----------|
| [2026-07-24 zhao-sso-wechat-login-design](file:///d:/zhao/strapi/docs/superpowers/specs/2026-07-24-zhao-sso-wechat-login-design.md) | 后端 SSO 微信登录基础设施（wechatRedirect/callback/miniprogram/app/jssdk-signature/config） | 不改动后端 |
| [2026-07-25 sso-fallback-login-design](file:///d:/zhao/docs/superpowers/specs/2026-07-25-sso-fallback-login-design.md) | wx-sso-login 组件降级（password-authorize、fallbackEnabled/fallbackMode） | 不改动 strapi-backend |
| [2026-07-26 sso-login-fallback-design](file:///d:/zhao/docs/superpowers/specs/2026-07-26-sso-login-fallback-design.md) | SSO 登录页/回调页/注册页（strapi-backend/sso/*） | 不改动 strapi-backend |
| [2026-07-27 sso-wechat-auto-login-design](file:///d:/zhao/docs/superpowers/specs/2026-07-27-sso-wechat-auto-login-design.md) | C 端微信环境自动跳 SSO（login.vue onMounted） | 本设计在此基础上增加降级链 |

**本设计真正新增**：
1. 降级链架构（三方 → SSO → 本地）—— 历史设计未实现
2. auth-callback 兜底分销关系 —— 历史设计未实现

## 背景与问题

### 当前架构

strapi-course 前端登录页（[login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue)）采用 **互斥模式**：`authConfig.mode` 决定单一登录方式（`'third'` / `'sso'` / `'local'`），5 个 `v-if` 互斥分支渲染对应 UI。

### 登录流程合理性审查发现

审查 [auth-callback.vue](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 和 [zhao-third 后端](file:///d:/zhao/strapi/plugins/zhao-third/server/src/services/third-party-auth.ts) 后发现 **4 个邀请码丢失风险**：

#### 风险 1：SSO 回调路径无前端兜底

[auth-callback.vue:85-89](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) SSO 路径（token 参数）登录成功后立即清除 `inviteCode`/`channelInviteCode` storage，但未调用 `joinChannelByInvite`。依赖后端 `channel-sync.syncUserInvite`，失败时只 warn 不重试 → 邀请码丢失。

#### 风险 2：zhao-third 回调路径丢弃 channelInviteCode

[zhao-third controller:50](file:///d:/zhao/strapi/plugins/zhao-third/server/src/controllers/third-party-auth.ts) 只解构 `inviteCode`，**不接收 channelInviteCode**：

```typescript
const { platform, appType, code, encryptedData, iv, inviteCode } = ctx.request.body;
```

前端 [auth-callback.vue:128](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 传了 `channelInviteCode`，但后端丢弃 → 渠道码丢失。

#### 风险 3：zhao-third 只在新用户创建时处理邀请码

[third-party-auth.ts:320-344](file:///d:/zhao/strapi/plugins/zhao-third/server/src/services/third-party-auth.ts) `createUserFromThirdParty` 只在首次注册时调用 `channelService.createForUser(user.id, inviteCode)`。

**老用户登录**（已存在用户）→ 不处理邀请码 → 邀请码丢失。

#### 风险 4：zhao-third 失败只 warn

[third-party-auth.ts:343-344](file:///d:/zhao/strapi/plugins/zhao-third/server/src/services/third-party-auth.ts) 邀请码处理失败只 `strapi.log.warn`，不重试，不通知前端 → 邀请码丢失。

### 其他问题

5. **无降级链**：third 模式下不会走 SSO，SSO 模式下不会走本地，非互斥降级不可行
6. **微信环境不覆盖 mode**：`local` 模式下微信浏览器显示本地表单，不自动跳微信
7. **register.vue 表单 inviteCode 空值丢失**：用户清空表单 inviteCode 字段时，注册接口收到空值，丢失用户码

## 目标

1. 登录方式改为 **自动降级链**：三方 → SSO → 本地
2. 微信环境 **总是自动跳微信**（优先级高于 mode）
3. auth-callback 兜底建立分销关系（覆盖 SSO 路径 + third 路径，解决风险 1-4）
4. 不改动现有邀请码参数命名和 storage key
5. 不改动后端任何接口（风险 2-4 由前端兜底覆盖）

## 不改动清单

- URL 参数命名：C 端 `?invitecode=xxx`，后台 `?code=xxx`
- storage key：`inviteCode` / `channelInviteCode` / `webChannelInviteCode`
- `handleInviteLink()` 的参数变体支持
- 后端任何接口（SSO channel-sync、zhao-channel、zhao-auth）
- 不引入 `useInviteCode`（strapi-backend 无此接口）
- 不解码 SSO state 补全邀请码（只从 storage 读）

## 设计详情

### 1. 降级链决策树

```
用户进入 login.vue（onMounted）
  │
  ├─ 步骤 1：微信环境检测（最高优先级，覆盖 mode）
  │   ├─ MP-WEIXIN + third 可用 → silentLogin（三方）
  │   ├─ H5 + 微信浏览器 + third 可用 → snsapi_base 自动跳微信（三方）
  │   └─ 微信环境但 third 不可用 → 进入步骤 2 降级链
  │
  ├─ 步骤 2：非微信环境降级链
  │   ├─ 优先级 1：third 可用？
  │   │   ├─ H5 非微信浏览器 + openPlatform 启用 → PC 扫码入口
  │   │   └─ 其他 → 显示"微信登录"按钮
  │   ├─ 优先级 2：sso 可用？（ssoLoginUrl 配置）
  │   │   └─ 显示 SSO 登录入口（自动跳或按钮）
  │   └─ 优先级 3：兜底 → 本地表单
  │
  └─ 步骤 3：页面渲染
      主入口区（autoTrigger 优先级最高）+ 备选入口列表（其他可用项）
```

### 2. 新增 `resolveLoginChain()` 决策函数

返回有序的可用登录方式列表：

```typescript
interface LoginOption {
  key: 'wechat-mp' | 'wechat-h5' | 'wechat-pc' | 'sso' | 'local'
  priority: number      // 1=最高
  autoTrigger: boolean  // 是否自动触发（无需用户点击）
  available: boolean
  trigger: () => void   // 触发函数
}
```

### 3. 替换原 5 个互斥分支

原模板 5 个 `v-if` 互斥分支 → **主入口区（priority=1）+ 备选入口列表（priority>=2）**。

- 主入口区：渲染最高优先级可用项（autoTrigger=true 则 onMounted 自动调用）
- 备选区：其他可用项作为备选按钮（如"使用账号密码登录"、"使用 SSO 登录"）

### 4. 微信环境覆盖逻辑

新增 `resolveWechatAutoLogin()` 函数，优先级高于 authMode：

```
微信浏览器环境（isH5Wechat=true）
  ├─ third 可用 + wechatOfficialAccountEnabled → 自动 snsapi_base 跳微信
  ├─ third 不可用 + SSO 可用 → 自动跳 SSO（SSO 后端再跳微信）
  └─ 都不可用 → 显示本地表单 + 微信按钮
```

**SSO 模式 + 微信浏览器 + third 可用时**：直接跳三方（绕过 SSO），减少跳转层级。

### 5. 小程序环境

保持现状：
- App.vue 的 `silentLogin` 仍由 `authMode === 'third'` 触发
- 小程序不走 SSO（SSO 是 H5 跳转机制）
- 降级链在小程序环境：third 可用 → silentLogin；third 不可用 → 显示本地表单

### 6. 防 SSO 循环跳转

继承现有 4 重防循环检查（[App.vue](file:///d:/zhao/strapi-course/App.vue)）：
1. URL 不带 code 参数
2. 不在 auth-callback 页
3. 5 分钟 TTL（`h5AutoLoginAttemptedAt`）
4. storage 标记

### 7. auth-callback 兜底逻辑（覆盖 SSO 路径 + third 路径）

**两条回调路径都需要兜底**：

- **SSO 路径**（token 参数）：解决风险 1（后端 channel-sync 失败无重试）
- **third 路径**（code 参数 → /zhao-third/callback）：解决风险 2-4（后端丢弃 channelInviteCode、老用户不处理、失败只 warn）

```
auth-callback.vue 接收回调
  │
  ├─ 路径 A：SSO 回调（URL 有 token 参数）
  │   ├─ 步骤 1a：写入 token + user
  │   └─ 步骤 2a：兜底建立分销关系（新增）
  │
  ├─ 路径 B：third 回调（URL 有 code 参数）
  │   ├─ 步骤 1b：POST /zhao-third/v1/third/callback 换 token
  │   ├─ 步骤 2b：写入 token + user
  │   └─ 步骤 2b'：兜底建立分销关系（新增）
  │
  └─ 共同步骤 3：兜底逻辑（两条路径都执行）
      │  从 storage 读取 inviteCode / channelInviteCode
      ├─ 有 inviteCode → 调 joinChannelByInvite(inviteCode)
      │   ├─ 成功 → 清除 inviteCode storage
      │   └─ 失败 → 保留 inviteCode storage（下次登录再试）
      ├─ 有 channelInviteCode → 调 joinChannelByInvite(channelInviteCode)
      │   ├─ 成功 → 清除 channelInviteCode storage
      │   └─ 失败 → 保留 channelInviteCode storage
      └─ 无邀请码 → 跳过

  ├─ 步骤 4：清理无关 storage（wxAuthScope, wxAuthAppType, h5AutoLoginAttemptedAt）
  │
  └─ 步骤 5：跳转
      ├─ state 参数存在 → reLaunch(state)  ← 导航 URL
      └─ 否则 → switchTab(/pages/index/index)
```

**关键改动**：
- 抽取 `bindInviteCodesAfterCallback()` 为独立函数，在两条路径的"写入 token 后"统一调用
- 原 [auth-callback.vue:87-88](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 和 [L146-148](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 直接清除 storage 的代码删除，改由兜底函数成功后才清除
- 原 [L118-119](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) third 路径传给后端的 inviteCode/channelInviteCode 保留（后端可能处理），前端兜底是补充

### 8. 统一兜底函数

抽取到 [utils/invite.ts](file:///d:/zhao/strapi-course/utils/invite.ts)（从 [login.vue:745-785](file:///d:/zhao/strapi-course/pages/login/login.vue) 现有实现抽取，保持两个接口分工）：

```typescript
import { useInviteCode, joinChannelByInvite } from '../services/api'

export async function bindInviteCodesAfterLogin(): Promise<void> {
  const inviteCode = uni.getStorageSync('inviteCode') || ''
  const channelInviteCode = uni.getStorageSync('channelInviteCode') || ''

  // 用户邀请码（来自 v.joho.cn）→ useInviteCode（/user-invites/use）
  if (inviteCode) {
    try {
      await useInviteCode(inviteCode)
      uni.removeStorageSync('inviteCode')
    } catch (e) {
      console.warn('[invite] 绑定用户邀请码失败，保留 storage', e)
    }
  }

  // 渠道邀请码（来自 h.joho.cn）→ joinChannelByInvite（/channel-invite/join，幂等）
  if (channelInviteCode) {
    try {
      await joinChannelByInvite(channelInviteCode)
      uni.removeStorageSync('channelInviteCode')
    } catch (e) {
      console.warn('[invite] 加入渠道失败，保留 storage', e)
    }
  }
}
```

**接口分工（保持 login.vue 现有实现）**：
- `useInviteCode(code)` → POST `/zhao-channel/v1/user-invites/use` → 处理用户邀请码
- `joinChannelByInvite(inviteCode)` → POST `/zhao-channel/v1/channel-invite/join` → 处理渠道邀请码（[channel-member.ts:271-278](file:///d:/zhao/strapi/plugins/zhao-channel/server/src/services/channel-member.ts) 已保证幂等）

**调用方**：
- login.vue 本地登录成功后调用（替代现有 `bindInviteCodesAfterLogin`，移除原 toast 提示）
- auth-callback.vue 三方/SSO 回调成功后调用（新增）

### 9. register.vue 表单空值回退

[register.vue:199-205](file:///d:/zhao/strapi-course/pages/register/register.vue) 修正：

```typescript
const res = await register({
  username, email, password,
  // 表单优先（用户可编辑），表单空则回退 storage（防止用户清空表单丢失）
  inviteCode: registerForm.value.inviteCode || uni.getStorageSync('inviteCode') || undefined,
  // 渠道码始终从 storage 取（不在表单展示）
  channelInviteCode: uni.getStorageSync('channelInviteCode') || undefined
})
```

### 10. 本地注册后处理

后端 `sso-auth.register` 已调 `buildInviteRelation` 建立分销关系。前端注册成功后**不重复调用** `joinChannelByInvite`，直接清除 storage：

```typescript
if (resData.jwt ?? resData.token) {
  setLoginState({ token: resData.jwt ?? resData.token, user: resData.user })
  uni.removeStorageSync('inviteCode')
  uni.removeStorageSync('channelInviteCode')
  uni.showToast({ title: '注册成功', icon: 'success' })
  setTimeout(() => uni.switchTab({ url: '/pages/index/index' }), 1000)
}
```

## 分销关系建立路径汇总

| 路径 | 后端处理 | 前端兜底 | 兜底解决的风险 |
|------|----------|----------|---------------|
| C 端本地注册 | `sso-auth.buildInviteRelation`（成功） | 无需 | — |
| C 端本地登录 | 无 | `useInviteCode` + `joinChannelByInvite`（login.vue 已有，抽取到 utils） | — |
| C 端 SSO 回调 | `channel-sync.syncUserInvite`（可能失败，只 warn） | `useInviteCode` + `joinChannelByInvite`（auth-callback 新增） | 风险 1 |
| C 端 third 回调（新用户） | `createForUser`（可能失败，只 warn）；**不处理 channelInviteCode** | `useInviteCode` + `joinChannelByInvite`（auth-callback 新增） | 风险 2、4 |
| C 端 third 回调（老用户） | **不处理** | `useInviteCode` + `joinChannelByInvite`（auth-callback 新增） | 风险 3 |
| 后台注册 | 无 | `joinChannelByInvite`（strapi-backend 现有） | — |

**接口分工**：
- `useInviteCode(inviteCode)` → 处理用户邀请码（来自 v.joho.cn）
- `joinChannelByInvite(channelInviteCode)` → 处理渠道邀请码（来自 h.joho.cn，幂等）

**关键说明**：
- third 路径前端 [auth-callback.vue:128](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) 仍传 inviteCode/channelInviteCode 给后端（后端可能部分处理）
- 前端兜底是**补充**，不依赖后端是否处理成功
- `joinChannelByInvite` 后端已保证幂等（[channel-member.ts:271-278](file:///d:/zhao/strapi/plugins/zhao-channel/server/src/services/channel-member.ts)）
- `useInviteCode` 需验证幂等性（实施阶段确认 `service.useInvite` 是否检查已使用）

## 邀请码 storage 生命周期

| 路径 | 写入时机 | 清除时机 | 兜底机制 |
|------|----------|----------|----------|
| 本地注册 | handleInviteLink | 注册成功后清除 | 后端 buildInviteRelation |
| 本地登录 | handleInviteLink | `bindInviteCodesAfterLogin` 成功后 | 前端 joinChannelByInvite |
| 三方/SSO 回调 | handleInviteLink | `bindInviteCodesAfterLogin` 成功后 | 前端 joinChannelByInvite（新增） |
| 无邀请码直接登录 | 无 | 无 | 无 |

## 边界情况

| 场景 | 行为 |
|------|------|
| 微信浏览器 + third 未配置 | 降级到 SSO（若可用）→ 否则本地表单 |
| PC 浏览器 + third 配置但开放平台未配置 | 跳过三方，降级到 SSO/本地 |
| SSO 模式 + 微信浏览器 + third 可用 | 直接跳三方（绕过 SSO） |
| 三方登录回调失败 | auth-callback 降级到登录页，用户可用其他方式 |
| 后端已建立分销 + 前端兜底再调 | 幂等（后端 skip，前端成功清除 storage） |
| 后端失败 + 前端兜底成功 | 分销关系建立，清除 storage |
| 后端失败 + 前端兜底也失败 | 保留 storage，下次登录再试 |
| 无邀请码（直接登录） | 跳过兜底，直接清理其他 storage |
| 用户在 auth-callback 页刷新 | 重新触发兜底（幂等，安全） |

## 影响范围

### 改动文件

| 文件 | 改动 | 解决问题 |
|------|------|----------|
| [pages/login/login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) | 新增 `resolveLoginChain()` / `resolveWechatAutoLogin()`，重构 onMounted 决策，模板改为主入口+备选列表 | 问题 5、6 |
| [pages/auth-callback/auth-callback.vue](file:///d:/zhao/strapi-course/pages/auth-callback/auth-callback.vue) | 新增 `bindInviteCodesAfterCallback()`，SSO 路径和 third 路径都调用；删除原直接清除 storage 的代码 | 风险 1-4 |
| [utils/invite.ts](file:///d:/zhao/strapi-course/utils/invite.ts) | 新增 `bindInviteCodesAfterLogin()` 统一函数 | 风险 1-4 |
| [pages/register/register.vue](file:///d:/zhao/strapi-course/pages/register/register.vue) | 表单 inviteCode 空值回退 storage | 问题 7 |

### 不改动文件

- 后端任何文件（zhao-sso、zhao-channel、zhao-auth）
- strapi-backend 管理后台
- App.vue 的 handleInviteLink / silentLogin / snsapi_base 自动登录逻辑
- utils/env.ts 的微信环境检测
- wx-login.ts / wx-h5-login.ts / wx-open-platform-login.ts

## 测试策略

### 测试方式

不引入自动化测试框架，采用手动测试 + 浏览器开发者工具：
- `?debugWx=1` 参数模拟微信环境
- 浏览器 storage 面板手动设置 inviteCode/channelInviteCode
- 网络面板监控 `joinChannelByInvite` 调用

### 测试场景

**第一层：降级链决策**

| # | 场景 | 环境模拟 | 预期行为 |
|---|------|----------|----------|
| 1 | 微信小程序 + third | MP-WEIXIN | silentLogin 自动触发 |
| 2 | H5 微信浏览器 + third | `?debugWx=1` H5 | snsapi_base 自动跳微信 |
| 3 | H5 微信浏览器 + SSO（third 不可用） | `?debugWx=1` + ssoLoginUrl | 自动跳 SSO |
| 4 | H5 微信浏览器 + local（都不可用） | `?debugWx=1` + 无 ssoLoginUrl | 显示本地表单 + 微信按钮 |
| 5 | PC 浏览器 + third + 开放平台 | H5 非微信 + openPlatformEnabled | 显示扫码入口 |
| 6 | PC 浏览器 + SSO（third 不可用） | H5 非微信 + ssoLoginUrl | 显示 SSO 入口 |
| 7 | PC 浏览器 + local（都不可用） | H5 非微信 + 无配置 | 显示本地表单 |

**第二层：邀请码分销兜底**

| # | 场景 | 预期行为 | 覆盖风险 |
|---|------|----------|---------|
| 8 | C 端本地注册带邀请码 | 注册成功 + 后端建立分销 + 清除 storage | — |
| 9 | C 端 SSO 登录带邀请码（后端成功） | auth-callback 兜底幂等调 joinChannelByInvite + 清除 storage | 风险 1 |
| 10 | C 端 SSO 登录带邀请码（后端失败） | auth-callback 兜底调 joinChannelByInvite 成功 + 清除 storage | 风险 1 |
| 11 | C 端 third 登录带邀请码（新用户） | auth-callback 兜底覆盖后端 createForUser 失败 + 清除 storage | 风险 4 |
| 12 | C 端 third 登录带邀请码（老用户） | auth-callback 兜底调 joinChannelByInvite + 清除 storage | 风险 3 |
| 13 | C 端 third 登录带 channelInviteCode | auth-callback 兜底调 joinChannelByInvite(channelInviteCode) + 清除 storage | 风险 2 |
| 14 | 兜底失败保留 storage | storage 保留，下次登录再试 | — |
| 15 | 无邀请码直接登录 | 跳过兜底，不报错 | — |
| 16 | 幂等（后端已建立 + 前端再调） | 后端 skip，前端成功清除 storage | — |

**第三层：防循环与边界**

| # | 场景 | 预期行为 |
|---|------|----------|
| 17 | SSO 回跳 auth-callback 不再触发自动跳转 | auth-callback 页不调 redirectToSso |
| 18 | 微信回调带 code 不再触发 snsapi_base | URL 有 code 参数时不自动跳微信 |
| 19 | 5 分钟 TTL 防循环 | h5AutoLoginAttemptedAt TTL 内不重复跳转 |
| 20 | register.vue 表单清空 inviteCode | 表单空 → 回退 storage → 注册接口收到邀请码 |
| 21 | 后台 `h.joho.cn/?code=xxx` | 走 strapi-backend 现有逻辑（不改动） |

### 验证清单

```
[ ] 场景 1-7：降级链决策正确
[ ] 场景 8-16：邀请码分销兜底正确（覆盖风险 1-4）
[ ] 场景 17-21：防循环与边界正确
[ ] C 端 v.joho.cn 链接：?invitecode=xxx 流程通畅
[ ] 后台 h.joho.cn 链接：?code=xxx 流程通畅（未改动）
[ ] 无邀请码登录不受影响
[ ] 现有 SSO/third 模式不回归
```

## 兼容性

- `authConfig.mode` 字段保留，作为默认提示（影响主按钮文案），但不再硬性互斥
- 现有 SSO 自动跳转逻辑保留（在降级链中作为优先级 2 的 autoTrigger 项）
- 现有 App.vue 的 silentLogin / snsapi_base 自动登录逻辑不变
- 现有防循环 4 重检查不变
