/**
 * 微信 JS-SDK 初始化和分享配置工具
 * 仅 H5 环境使用
 */
import { request } from '../services/api'
import { getInviteCode } from './invite'
import { BASE_URL, SITE_DOMAIN } from './env'
import { getUser } from './storage'
import { getStoredAuthConfig } from '../services/auth-config'

declare const wx: any

// JS-SDK config 状态(避免未 config 时调用 configShare 静默失败)
let jssdkReady = false
let jssdkConfiguring = false
const pendingShareConfigs: any[] = []

// 默认分享内容
const DEFAULT_SHARE = {
  title: '学习课程，答题赢积分',
  desc: '快来一起学习吧！',
  imgUrl: `${BASE_URL}/static/share-image.png`,
}

/**
 * 将 sharePath 补全为完整 URL
 * - 已带 http(s):// → 直接返回
 * - 相对路径（如 /pages/index/index）→ 拼接 window.location.origin
 */
function resolveShareUrl(sharePath: string | undefined): string {
  const base = window.location.origin
  if (!sharePath) return base
  if (sharePath.startsWith('http://') || sharePath.startsWith('https://')) {
    return sharePath
  }
  const path = sharePath.startsWith('/') ? sharePath : `/${sharePath}`
  return `${base}${path}`
}

/** 页面自定义分享配置 */
export interface PageShareConfig {
  title?: string      // 页面自定义标题（如课程标题），不传用默认
  desc?: string       // 页面自定义描述（如课程简介），不传用默认
  imgUrl?: string     // 页面自定义图片（如课程封面），不传用默认
  pageUrl?: string    // 分享落地页 URL，不传用首页
}

/** JS-SDK 分享配置 */
interface ShareConfig {
  title: string
  desc?: string
  link: string
  imgUrl: string
}

// 当前页面分享配置（可被 setPageShare 覆盖）
let currentPageShare: PageShareConfig | null = null

/**
 * 初始化微信 JS-SDK（调用后端签名接口）
 * 注意:微信公众号网页需在 mp.weixin.qq.com 配置「JS接口安全域名」
 */
export async function initJSSDK(): Promise<void> {
  if (jssdkReady || jssdkConfiguring) return
  jssdkConfiguring = true

  try {
    // 获取当前页面 URL（不含 # 及之后部分，微信签名要求）
    const url = window.location.href.split('#')[0]

    const res = await request(`/zhao-third/v1/third/jssdk-signature?domain=${encodeURIComponent(SITE_DOMAIN)}`, {
      method: 'POST',
      data: { url }
    }) as any

    wx.config({
      debug: false,
      appId: res.appId,
      timestamp: res.timestamp,
      nonceStr: res.nonceStr,
      signature: res.signature,
      jsApiList: [
        'updateAppMessageShareData',
        'updateTimelineShareData',
      ]
    })

    wx.ready(() => {
      jssdkReady = true
      jssdkConfiguring = false
      // 刷新待处理的分享配置
      while (pendingShareConfigs.length > 0) {
        const cfg = pendingShareConfigs.shift()
        applyShareConfig(cfg)
      }
    })

    wx.error((err: any) => {
      jssdkConfiguring = false
      console.warn('[wx-jssdk] wx.config 失败:', err)
    })
  } catch (e) {
    jssdkConfiguring = false
    console.warn('[wx-jssdk] 初始化 JS-SDK 失败:', e)
  }
}

/**
 * 应用分享配置到微信(wx.ready 已触发后调用)
 */
function applyShareConfig(config: ShareConfig): void {
  // 分享给好友
  wx.updateAppMessageShareData({
    title: config.title,
    desc: config.desc ?? '',
    link: config.link,
    imgUrl: config.imgUrl,
    success: () => {}
  })
  // 分享到朋友圈
  wx.updateTimelineShareData({
    title: config.title,
    link: config.link,
    imgUrl: config.imgUrl,
    success: () => {}
  })
}

/**
 * 配置好友 + 朋友圈分享
 * 若 JS-SDK 未 ready,自动入队等待 initJSSDK 完成后刷新
 */
export function configShare(config: ShareConfig): void {
  if (jssdkReady) {
    applyShareConfig(config)
  } else {
    pendingShareConfigs.push(config)
    // 触发一次 initJSSDK(若未启动)
    if (!jssdkConfiguring) {
      initJSSDK()
    }
  }
}

/**
 * 配置分享内容（自动携带邀请码）
 * 标题/描述/图片优先取页面配置，不传用默认值兜底
 */
export function configShareWithInvite(pageShare?: PageShareConfig): void {
  const inviteCode = getInviteCode()
  const userId = getUser()?.id ?? ''
  const baseUrl = window.location.origin

  const cfg = pageShare ?? currentPageShare ?? {}
  const authConfig = getStoredAuthConfig()
  const title = cfg.title ?? authConfig?.shareTitle ?? DEFAULT_SHARE.title
  const desc = cfg.desc ?? authConfig?.shareDescription ?? DEFAULT_SHARE.desc
  const imgUrl = cfg.imgUrl ?? authConfig?.shareImage ?? DEFAULT_SHARE.imgUrl

  // 优先级：页面 pageUrl > 租户 sharePath（补全为完整 URL）> baseUrl
  let link = cfg.pageUrl
    ?? resolveShareUrl(authConfig?.sharePath)
    ?? baseUrl
  const separator = link.includes('?') ? '&' : '?'
  const params: string[] = []
  if (inviteCode) params.push(`inviteCode=${inviteCode}`)
  if (userId) params.push(`inviterId=${userId}`)
  if (params.length > 0) link += `${separator}${params.join('&')}`

  configShare({ title, desc, link, imgUrl })
}

/**
 * 设置当前页面的分享内容（供各页面 onShow 调用）
 * 例如: setPageShare({ title: course.title, desc: course.description, imgUrl: course.coverUrl })
 */
export function setPageShare(config: PageShareConfig): void {
  currentPageShare = config
  // 如果 JS-SDK 已初始化，立即刷新分享配置
  if (typeof wx !== 'undefined') {
    configShareWithInvite(config)
  }
}
