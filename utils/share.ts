/**
 * 统一分享辅助函数
 * H5 端调用 setPageShare 配置微信 JS-SDK 分享
 * 小程序端返回配置对象供 onShareAppMessage / onShareTimeline 使用
 */
import { getStoredAuthConfig } from '../services/auth-config'
import { getInviteCode, trackInviteFlow } from './invite'
import { getUser } from './storage'
import { applySeoMeta } from './seo-meta'

export interface PageShareInput {
  title?: string
  desc?: string
  imgUrl?: string
  /** 自定义落地页 URL；不传则用当前页面地址 */
  pageUrl?: string
}

export interface ShareConfig {
  title: string
  desc: string
  imgUrl: string
  pageUrl: string
}

/**
 * 将邀请参数（inviteCode + inviterId）附加到 URL（hash 路由兼容）
 * uni-app H5 使用 hash 路由，URL 格式如 http://host/#/pages/index/index?val
 * hash 路由的 query 参数在 # 之后，需要用 hash 单独处理
 * @param url 待附加的目标 URL
 * @param inviteCode 当前登录用户的邀请码（可空）
 * @param inviterId 当前登录用户 id（可空；建分销关系时用于前端明确邀约人）
 */
function appendInviteParams(
  url: string,
  inviteCode: string,
  inviterId: number | string | null | undefined
): string {
  // 拆分 hash 部分
  const [origin, hash = ''] = url.split('#')
  let path = hash
  let query = ''

  // hash 路由的 query 在 ? 之后
  const qIdx = hash.indexOf('?')
  if (qIdx >= 0) {
    path = hash.substring(0, qIdx)
    query = hash.substring(qIdx + 1)
  }

  const params = new URLSearchParams(query)
  if (inviteCode && !params.has('inviteCode')) {
    params.set('inviteCode', inviteCode)
  }
  if (inviterId != null && !params.has('inviterId')) {
    params.set('inviterId', String(inviterId))
  }
  const qs = params.toString()
  return `${origin}#${path}${qs ? '?' + qs : ''}`
}

/**
 * 统一设置页面分享（H5 + 小程序通用）
 *
 * 优先级：
 *   - title/desc/imgUrl: 页面传入 > 租户配置(authConfig) > 空字符串
 *   - pageUrl: 页面传入 > 当前页面地址 > 租户 sharePath
 *
 * 邀请码：仅登录用户（getUser() 不为 null）才附加 inviteCode
 *
 * @param input 页面分享配置（可选字段，缺失用租户配置兜底）
 * @returns 小程序端返回 ShareConfig 供 onShareAppMessage 使用；H5 端无返回
 */
export function setupPageShare(input: PageShareInput = {}): ShareConfig | void {
  const authConfig = getStoredAuthConfig()

  // 优先级：页面传入 > 租户配置 > 空字符串
  const title = input.title ?? authConfig?.shareTitle ?? ''
  const desc = input.desc ?? authConfig?.shareDescription ?? ''
  const imgUrl = input.imgUrl ?? authConfig?.shareImage ?? ''

  // pageUrl 优先级：页面传入 > 当前页面地址
  const pageUrl = input.pageUrl ?? window.location.href

  // 仅登录用户附加邀请参数（邀请码 + 邀请人 id）
  const user = getUser()
  let finalUrl = pageUrl
  if (user) {
    const inviteCode = getInviteCode()
    // 优先分享当前用户自身，避免复刻来源页的他人邀请参数而自邀
    const inviterId = user.id
    finalUrl = appendInviteParams(pageUrl, inviteCode, inviterId)
    // 埋点：分享发出，记录分享链接是否带邀请码与邀请人
    trackInviteFlow('share_sent', {
      inviteCode: finalUrl.includes('inviteCode=') ? inviteCode : '',
      inviterId,
      pagePath: pageUrl,
      targetType: 'exchange',
      loggedIn: true,
      detail: finalUrl.includes('inviteCode=') ? '带邀请码' : '未带邀请码',
    })
  }

  const config: ShareConfig = { title, desc, imgUrl, pageUrl: finalUrl }

  // #ifdef H5
  applySeoMeta({ title, desc, imgUrl })
  if (typeof window !== 'undefined' && (window as any).setPageShare) {
    ;(window as any).setPageShare(config)
  }
  // #endif

  // #ifndef H5
  return config
  // #endif
}
