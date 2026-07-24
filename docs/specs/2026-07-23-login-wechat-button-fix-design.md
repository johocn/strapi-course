# strapi-course 登录页微信登录按钮不显示修复设计

- **日期**: 2026-07-23
- **范围**: `strapi-course`（C 端 uni-app）
- **状态**: 已批准，待生成实现计划

## 1. 问题边界

### 1.1 现象

访问 `http://localhost:5173/#/pages/login/login?debugWx=1`，页面显示"欢迎登录"标准表单（手机验证码/账号密码），**不显示"微信快捷登录"卡片**（快速登录 + 完善资料登录按钮）。

### 1.2 根因

前端登录页 [login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) 三个微信登录分支都只认 `authMode === 'third'`，但后端实际返回的数据是：

```json
"auth": {
    "mode": "local",
    "methods": ["password", "sms", "wechat"],
    "wechatOfficialAccountEnabled": false,
    "thirdPartyEnabled": true
}
```

后端 [config.ts:386](file:///d:/zhao/strapi/plugins/zhao-common/server/src/services/config.ts#L386) 逻辑：`if (authMode === "third" || thirdPartyEnabled) methods.push("wechat")` —— **methods 含 wechat 就是"启用微信登录"的信号**，由 `thirdPartyEnabled=true` 触发，不要求 `mode === "third"`。

前端忽略了 `methods.includes("wechat")` 和 `thirdPartyEnabled` 这两个信号，只认 `mode === 'third'`，导致分支条件永远 false。

### 1.3 关键事实

- 后端返回的数据是**正确的**：methods 含 wechat 是 thirdPartyEnabled 触发的正确行为
- 后端 auth 配置存在 `site-config.extraConfig`（json 字段），[config.ts:376](file:///d:/zhao/strapi/plugins/zhao-common/server/src/services/config.ts#L376) 读取 `ec.authMode ?? "local"`，当前 extraConfig 无 authMode → 回退 local（这是设计，不是 bug）
- `?debugWx=1` 调试后门在 [env.ts:80](file:///d:/zhao/strapi-course/utils/env.ts#L80) 强制 `isWechatBrowser()` 返回 true，模拟微信浏览器 UA 环境——后门工作正常，但配合 `authMode === 'third'` 条件仍不满足
- 这是**前端判断逻辑 bug**，不是后端配置问题

## 2. 修复原则

1. **只改前端**：后端返回的数据是对的，不动后端
2. **综合判断而非单一信号**：用 `methods.includes('wechat') || thirdPartyEnabled || mode==='third'` 三个信号取或，符合后端 config.ts:386 的设计意图
3. **保留 `?debugWx=1` 调试后门**：职责不同（模拟 UA 环境），已存在且正确，不动
4. **不动 SSO 分支**：SSO 是独立模式，不与微信混用
5. **不写单元测试**：strapi-course 是 uni-app，无 jest 环境，采用手动验证

## 3. 修复方案

### 3.1 新增 `wechatLoginEnabled` 计算属性

**文件**：`d:\zhao\strapi-course\pages\login\login.vue`

在第 353 行 `registerEnabled` 计算属性后添加：

```typescript
// 微信登录是否启用（综合判断：methods 含 wechat 或 thirdPartyEnabled 或 mode=third）
const wechatLoginEnabled = computed(() => 
  authConfig.value?.methods?.includes('wechat') === true 
  || authConfig.value?.thirdPartyEnabled === true 
  || authMode.value === 'third'
)
```

### 3.2 修改三处分支条件

| 行号 | 当前条件 | 修正后条件 | 渲染内容 |
|---|---|---|---|
| 24 | `authMode === 'third' && isWechat && !isH5Wechat` | `wechatLoginEnabled && isWechat && !isH5Wechat` | 微信小程序自动登录 |
| 62 | `authMode === 'third' && isH5Wechat` | `wechatLoginEnabled && isH5Wechat` | H5 微信快捷登录 |
| 272 | `authMode === 'third' && isH5 && !isH5Wechat && openPlatformEnabled` | `wechatLoginEnabled && isH5 && !isH5Wechat && openPlatformEnabled` | PC 扫码登录 |

### 3.3 效果验证

用真实数据（mode=local, methods含wechat, thirdPartyEnabled=true）：
- `wechatLoginEnabled = true`（因 methods 含 wechat）
- `?debugWx=1` → `isH5Wechat = true`（env.ts 后门）
- 第 62 行：`true && true` = **true** → 显示"微信快捷登录"卡片 ✓

## 4. 不改的内容

- `services/auth-config.ts` — 配置读取逻辑正确
- `utils/env.ts` — `isWechatBrowser()` 和 `?debugWx=1` 后门正确
- 后端任何文件 — 后端返回数据正确
- SSO 分支（第 112 行 `authMode === 'sso'`）— SSO 独立模式
- 底部"其他登录方式"微信图标（第 319 行 `authMode !== 'sso' && !isH5Wechat`）— 降级入口逻辑正确

## 5. 改动文件清单（1 个文件）

**修改**：
1. [strapi-course/pages/login/login.vue](file:///d:/zhao/strapi-course/pages/login/login.vue) — 新增 `wechatLoginEnabled` 计算属性 + 修改 3 处分支条件

## 6. 验证步骤

### 6.1 默认访问（非微信环境）

访问 `http://localhost:5173/#/pages/login/login`：
- `methods含wechat` → `wechatLoginEnabled=true`
- 但 `isH5Wechat=false`（Chrome UA 无 micromessenger）
- 预期：走 `v-else` 标准表单（手机验证码/账号密码），不显示微信快捷登录（正确，因非微信环境）

### 6.2 调试模式（模拟微信环境）

访问 `http://localhost:5173/#/pages/login/login?debugWx=1`：
- `wechatLoginEnabled=true` + `isH5Wechat=true`（debugWx 后门）
- 预期：第 62 行 `true && true` = true → **显示"微信快捷登录"卡片**（快速登录 + 完善资料登录 + 降级账号密码）✓

### 6.3 回归验证

- 非 `?debugWx=1` 的普通浏览器访问：仍显示标准表单（不误显微信按钮）
- SSO 模式（若后端改 mode=sso）：第 112 行仍正常显示 SSO 登录
- 小程序环境（mp-weixin 编译）：第 24 行 `wechatLoginEnabled && isWechat && !isH5Wechat` 正常触发自动登录

## 7. 回归风险

| 风险 | 缓解 |
|---|---|
| `wechatLoginEnabled` 为 true 但 wechatOfficialAccountEnabled=false 时点"快速登录"报错 | 这是已有逻辑，login.vue:492 的 onMounted 会检查 `wechatOfficialAccountEnabled` 决定是否自动登录；手动点"快速登录"会调 `redirectToWechatAuth` 走 OAuth，若未配置公众号会跳转失败提示——属配置问题非代码 bug |
| 三方登录未配置 appId/appSecret 时点击报错 | 同上，属配置问题，前端已有 try-catch 兜底 |
| `methods` 字段缺失时 `.includes` 报错 | 用 `?.includes(...)` + `=== true` 防御 |
