/**
 * 微信开放平台扫码登录工具
 * 支持内嵌二维码和跳转扫码两种模式
 */
import { request } from '../services/api'
import { setToken, setUser } from './storage'

/**
 * 获取微信开放平台内嵌二维码 URL
 */
export async function getQrconnectUrl(redirectUrl: string): Promise<{ qrconnectUrl: string; redirectAuthUrl: string; state: string; appId: string }> {
  const res = await request('/zhao-third/v1/third/qrconnect-url', {
    method: 'POST',
    data: { redirectUrl },
  }) as any
  return {
    qrconnectUrl: res.qrconnectUrl,
    redirectAuthUrl: res.redirectAuthUrl,
    state: res.state,
    appId: res.appId,
  }
}

/**
 * 获取微信开放平台跳转授权 URL
 */
export async function getOpenPlatformAuthUrl(redirectUrl: string): Promise<string> {
  const res = await request('/zhao-third/v1/third/auth-url', {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'open_platform',
      redirectUrl,
    },
  }) as any
  return res.authUrl
}

/**
 * 处理开放平台扫码回调
 */
export async function handleOpenPlatformCallback(code: string, inviteCode?: string, channelInviteCode?: string): Promise<{ token: string; user: any; isNewUser: boolean }> {
  const res = await request('/zhao-third/v1/third/callback', {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'open_platform',
      code,
      inviteCode,
      channelInviteCode,
    },
  }) as any

  if (res.jwt) {
    setToken(res.jwt)
    if (res.user) setUser(res.user)

    uni.removeStorageSync('inviteCode')
    uni.removeStorageSync('channelInviteCode')
  }

  return {
    token: res.jwt,
    user: res.user,
    isNewUser: res.isNew,
  }
}

/**
 * 重定向到微信开放平台扫码页（跳转模式）
 */
export async function redirectToOpenPlatformAuth(): Promise<void> {
  // 保存 appType 到 storage，供回调页读取
  uni.setStorageSync('wxAuthAppType', 'open_platform')

  const baseUrl = window.location.origin
  const redirectUrl = `${baseUrl}/#/pages/auth-callback/auth-callback`

  const authUrl = await getOpenPlatformAuthUrl(redirectUrl)
  window.location.href = authUrl
}
