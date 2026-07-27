// 生产环境同源 /api，开发环境通过 VITE_API_BASE 注入完整地址
export const BASE_API = import.meta.env?.VITE_API_BASE ?? '/api'

// 图片域名（含协议），Strapi 文件上传地址
// 生产环境同源，开发环境通过 VITE_BASE_URL 注入
export const BASE_URL = import.meta.env?.VITE_BASE_URL ?? ''

// 当前站点域名（用于 public/config 识别租户）
// H5 环境优先从 window.location.hostname 动态读取（支持 hosts 代理域名如 5.joho.cn）
// 小程序/APP 由 VITE_SITE_DOMAIN 注入，dev 默认 localhost
function resolveSiteDomain(): string {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname
  }
  // #endif
  return import.meta.env?.VITE_SITE_DOMAIN ?? 'localhost'
}

export const SITE_DOMAIN = resolveSiteDomain()

// 认证模式切换为内部时，会同步读取配置，文件 services/auth-config.ts
// 原 AUTH_MODE 环境变量已废弃

export type EnvType = 'wechat' | 'douyin' | 'alipay' | 'h5'

export const getEnv = (): { type: EnvType } => {
  // #ifdef MP-WEIXIN
  return { type: 'wechat' }
  // #endif
  // #ifdef MP-TOUTIAO
  return { type: 'douyin' }
  // #endif
  // #ifdef MP-ALIPAY
  return { type: 'alipay' }
  // #endif
  return { type: 'h5' }
}

/**
 * 拼接图片访问路径
 * @param path 图片相对路径
 * @returns 完整图片 URL
 */
export function getImageUrl(path: string | undefined): string {
  if (!path) return ''
  
// 域名已拼接至 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  // 路径开头 / 前缀直接拼接
  if (path.startsWith('/')) {
    return `${BASE_URL}${path}`
  }
  
  // 域名拼接路径
  return `${BASE_URL}/${path}`
}

/**
 * 判断当前是否在微信环境内，适配 H5 支付校验
 */
export function isWechatBrowser(): boolean {
  // #ifdef H5
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  // 1. 实现微信环境 UA 判断 micromessenger
  if (ua.includes('micromessenger')) return true
  // 2. ΢获取跳转回调地址
  if (typeof window !== 'undefined') {
    //  跳转微信授权完整域名
    if ((window as any).__wxConfig || (window as any).__wxInfo) return true
    // 跳转微信URL判断（servicewechat.com 以及本地调试开发者工具UA）
    const href = window.location.href
    if (href.includes('servicewechat.com')) return true
  }
  // 3. 地址URL强制调试白名单：?debugWx=1（同时检查 search 和 hash query，兼容 hash 路由）
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debugWx') === '1') return true
    const hashQuery = window.location.hash.split('?')[1] || ''
    const hashParams = new URLSearchParams(hashQuery)
    if (hashParams.get('debugWx') === '1') return true
  }
  // 4. 开发环境本地代理域名白名单（hosts 指向 127.0.0.1 + 公众号后台配 JS 安全域名）
  if (typeof window !== 'undefined') {
    const DEV_WX_HOSTS = ['5.joho.cn']
    if (DEV_WX_HOSTS.includes(window.location.hostname)) return true
  }
  return false
  // #endif
  // #ifndef H5
  return false
  // #endif
}
