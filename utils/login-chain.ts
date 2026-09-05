/**
 * 登录降级链决策工具
 *
 * 优先级：SSO 优先 → third → local
 * SSO 是否可用由 ssoEnabled && ssoLoginUrl 综合判断，不依赖 mode 字段。
 * （此前 28f33c8 把降级链改成 mode === 'sso' 互斥判断，导致后台仅开启 sso
 *   开关而未显式设 authMode='sso' 时 SSO 完全不参与，此处恢复为按开关判断）
 */
import type { AuthConfig } from '../services/auth-config'

/** SSO 是否可用：ssoEnabled 开启且已配置 ssoLoginUrl */
export function shouldUseSso(config: AuthConfig | null | undefined): boolean {
  return !!(config && config.ssoEnabled && config.ssoLoginUrl)
}

/**
 * 构建 SSO 页面跳转 URL（携带 app_code / return_url / c_end_url / 邀请码）
 * H5 环境专用；非 H5 环境返回空串
 * @param page 目标 SSO 页面：'login'（登录页，默认）| 'register'（注册页）
 * @param state 可选：登录/注册成功后应返回的 C 端页面路径（如 /pages/activity/detail?id=5）。
 *              会内嵌到 return_url/c_end_url（auth-callback）的 query 中，SSO 端原样拼回，
 *              auth-callback 据此 reLaunch 回来源页，避免统一落回首页。
 *
 * ssoLoginUrl 约定指向 SSO 登录页（形如 https://h.joho.cn/#/pages/sso/login），
 * C 端 return_url/c_end_url 均指向自身 auth-callback，SSO 认证完成后携带 token 回跳写入登录态。
 */
export function buildSsoPageUrl(
  config: AuthConfig | null | undefined,
  page: 'login' | 'register' = 'login',
  state?: string
): string {
  const ssoUrl = config?.ssoLoginUrl
  if (!ssoUrl) return ''
  // #ifdef H5
  // 注册页与登录页同址，替换路径段；若 ssoLoginUrl 非登录页格式则无法推导，返回空串
  let base = ssoUrl
  if (page === 'register') {
    base = ssoUrl.replace('/pages/sso/login', '/pages/sso/register')
    if (base === ssoUrl) return ''
  }

  const cEndBase = window.location.origin + '/#/pages/auth-callback/auth-callback'
  // state 附加到回调 URL（置于 hash query），SSO login-callback 的 redirectToTarget 会把
  // token/user 以 & 拼接在其后，最终 auth-callback 的 hashParams 可同时取到 state 与 token
  const callback = state ? `${cEndBase}?state=${encodeURIComponent(state)}` : cEndBase
  const params = new URLSearchParams({
    app_code: config?.ssoAppCode || 'course',
    return_url: callback,
    c_end_url: callback,
  })
  // 透传邀请码（与 register.vue 保持一致）
  const userInviteCode = uni.getStorageSync('inviteCode') || ''
  const channelInvite = uni.getStorageSync('channelInviteCode') || ''
  if (userInviteCode) params.append('invite_code', userInviteCode)
  if (channelInvite) params.append('channel_code', channelInvite)
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${params.toString()}`
  // #endif
  // #ifndef H5
  return ''
  // #endif
}

/** 构建 SSO 登录页跳转 URL */
export function buildSsoRedirectUrl(config: AuthConfig | null | undefined): string {
  return buildSsoPageUrl(config, 'login')
}

/** 构建 SSO 注册页跳转 URL（注册并入 SSO 时使用） */
export function buildSsoRegisterUrl(config: AuthConfig | null | undefined): string {
  return buildSsoPageUrl(config, 'register')
}
