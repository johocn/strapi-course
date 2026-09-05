/**
 * H5 微信公众号登录工具
 * 支持 snsapi_base（静默）和 snsapi_userinfo（授权弹窗）两种 scope
 */
import { request } from '../services/api'
import { setToken, setUser } from './storage'
import { SITE_DOMAIN } from './env'

/**
 * 获取微信 OAuth 授权 URL
 */
export async function getWechatAuthUrl(redirectUrl: string, scope: string = 'snsapi_base'): Promise<string> {
  const res = await request(`/zhao-third/v1/third/auth-url?domain=${encodeURIComponent(SITE_DOMAIN)}`, {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'official_account',
      redirectUrl,
      scope,
      state: encodeURIComponent(getCurrentPagePath()),
    }
  }) as any
  return res.authUrl || res.url
}

/**
 * 重定向到微信授权页
 * @param scope 'snsapi_base'（默认，静默）或 'snsapi_userinfo'（授权弹窗）
 * @param state 透传给微信的 state 参数，授权回调后会原样返回。建议编码来源页路径
 */
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

/**
 * 处理微信 OAuth 回调（code → token）
 */
export async function handleH5WechatCallback(code: string, scope?: string): Promise<{ token: string; user: any; isNewUser: boolean }> {
  const storedScope = scope ?? uni.getStorageSync('wxAuthScope') ?? 'snsapi_base'
  const inviteCode = uni.getStorageSync('inviteCode') ?? undefined
  const channelInviteCode = uni.getStorageSync('channelInviteCode') ?? undefined

  const res = await request('/zhao-third/v1/third/callback', {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'official_account',
      code,
      inviteCode,
      channelInviteCode,
      scope: storedScope,
    }
  }) as any

  if (res.token) {
    setToken(res.token)
    if (res.user) setUser(res.user)

    // 清除临时storage
    uni.removeStorageSync('wxAuthScope')
    uni.removeStorageSync('inviteCode')
    uni.removeStorageSync('channelInviteCode')
  }

  return res
}

/**
 * 获取当前页面路径（用于 state 参数）
 * 必须携带当前页面的 query 参数（如 /pages/activity/detail?id=xxx），
 * 否则微信授权回调后 state 丢失 id，导致报名/权益引导流程无法续接。
 */
export function getCurrentPagePath(): string {
  const pages = getCurrentPages()
  if (pages.length > 0) {
    const currentPage = pages[pages.length - 1] as any
    const route = '/' + currentPage.route
    const options = currentPage.options || currentPage.$page?.options || {}
    const keys = Object.keys(options)
    const query = keys
      .filter((k) => options[k] != null && options[k] !== '')
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(options[k]))}`)
      .join('&')
    return query ? `${route}?${query}` : route
  }
  return '/pages/index/index'
}
