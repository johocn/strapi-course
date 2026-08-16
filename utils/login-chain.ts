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
 * 构建 SSO 跳转 URL（携带 app_code / return_url / c_end_url / 邀请码）
 * H5 环境专用；非 H5 环境返回空串
 */
export function buildSsoRedirectUrl(config: AuthConfig | null | undefined): string {
  const ssoUrl = config?.ssoLoginUrl
  if (!ssoUrl) return ''
  // #ifdef H5
  // return_url 和 c_end_url 都指向 C 端 auth-callback 页面
  // SSO 认证完成后，login-callback.vue 直接携带 token 跳回 C 端 auth-callback 写入登录态
  const cEndCallback = window.location.origin + '/#/pages/auth-callback/auth-callback'
  const params = new URLSearchParams({
    app_code: config?.ssoAppCode || 'course',
    return_url: cEndCallback,
    c_end_url: cEndCallback,
  })
  // 透传邀请码（与 register.vue 保持一致）
  const userInviteCode = uni.getStorageSync('inviteCode') || ''
  const channelInvite = uni.getStorageSync('channelInviteCode') || ''
  if (userInviteCode) params.append('invite_code', userInviteCode)
  if (channelInvite) params.append('channel_code', channelInvite)
  const sep = ssoUrl.includes('?') ? '&' : '?'
  return `${ssoUrl}${sep}${params.toString()}`
  // #endif
  // #ifndef H5
  return ''
  // #endif
}
