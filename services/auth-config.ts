/**
 * 认证配置模块
 * 从后端获取认证配置，决定前端使用哪种登录方式
 */
import { request } from './api'
import { SITE_DOMAIN, BASE_URL } from '../utils/env'
import { applyTheme, ThemeConfig } from '../utils/theme'

export interface AuthConfig {
  // 站点信息
  siteName: string
  siteDescription: string
  logo: string
  favicon: string
  
  // 微信分享
  shareTitle: string
  shareDescription: string
  shareImage: string
  sharePath: string

  // 海报兜底配置（用户未登录/信息缺失时使用）
  posterDefaultUserName: string
  posterDefaultUserAvatar: string
  posterDefaultRecommendReason: string
  
  // 认证配置
  mode: 'local' | 'third' | 'sso'
  authMode: 'local' | 'third' | 'sso'
  methods: Array<'password' | 'sms' | 'wechat' | 'sso'>
  ssoLoginUrl: string | null
  ssoAppCode: string
  wechatOfficialAccountEnabled: boolean
  wechatMiniProgramEnabled: boolean
  wechatOpenPlatformEnabled: boolean
  alipayEnabled: boolean
  douyinEnabled: boolean
  thirdPartyEnabled: boolean
  ssoEnabled: boolean
  registerEnabled: boolean
  inviteCodeRequired: boolean
  
  // 功能开关（公开）
  pointsEnabled: boolean
  signInPoints: number
  coursePreviewEnabled: boolean
  lessonProgressEnabled: boolean
  channelInviteEnabled: boolean
  allowCrossChannel: boolean

  // 模块开关（featureFlags）+ 当前租户模块授权（moduleGrantedForCurrentTenant）
  exam: boolean
  activity: boolean
  roleGate: boolean
  moduleGranted: {
    exam: boolean
    activity: boolean
    course: boolean
  }

  // 主题配置
  theme?: ThemeConfig
}

/**
 * 从媒体对象或字符串中提取完整图片 URL
 * 兼容三种格式：媒体对象 { url, provider_metadata } / 字符串路径 / 完整 URL
 */
function resolveMediaUrl(media: any): string {
  if (!media) return ''
  // 已是字符串（向后兼容）
  if (typeof media === 'string') {
    return media.startsWith('http') ? media : `${BASE_URL}${media}`
  }
  // 媒体对象：优先 OSS，其次 localUrl + BASE_URL，最后 url + BASE_URL
  const meta = media.provider_metadata
  if (meta?.ossUrl && meta.ossStatus === 'success') return meta.ossUrl
  const raw = meta?.localUrl || media.url
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `${BASE_URL}${raw}`
}

let cachedConfig: AuthConfig | null = null
// 接口不可访问时的弹窗节流（30秒内只提示一次）
let lastUnavailableNotify = 0
const UNAVAILABLE_NOTIFY_INTERVAL = 30 * 1000

/**
 * 提示用户后端服务不可访问
 */
function notifyServiceUnavailable() {
  const now = Date.now()
  if (now - lastUnavailableNotify < UNAVAILABLE_NOTIFY_INTERVAL) return
  lastUnavailableNotify = now
  try {
    uni.showModal({
      title: '服务不可用',
      content: '无法连接到服务器（/api/zhao-common/v1/public/config），请检查后端 Strapi 服务是否已启动。',
      showCancel: false,
      confirmText: '我知道了'
    })
  } catch {
    // 非 uni 环境忽略
  }
}

const DEFAULT_CONFIG: AuthConfig = {
  siteName: '',
  siteDescription: '',
  logo: '',
  favicon: '',
  shareTitle: '',
  shareDescription: '',
  shareImage: '',
  sharePath: '/pages/index/index',
  posterDefaultUserName: '',
  posterDefaultUserAvatar: '',
  posterDefaultRecommendReason: '',
  mode: 'local',
  authMode: 'local',
  methods: ['password'],
  ssoLoginUrl: null,
  ssoAppCode: 'course',
  wechatOfficialAccountEnabled: false,
  wechatMiniProgramEnabled: false,
  wechatOpenPlatformEnabled: false,
  alipayEnabled: false,
  douyinEnabled: false,
  thirdPartyEnabled: false,
  ssoEnabled: false,
  registerEnabled: true,
  inviteCodeRequired: false,
  pointsEnabled: true,
  signInPoints: 10,
  coursePreviewEnabled: true,
  lessonProgressEnabled: true,
  channelInviteEnabled: true,
  allowCrossChannel: false,
  exam: true,
  activity: true,
  roleGate: false,
  moduleGranted: {
    exam: true,
    activity: true,
    course: true,
  },
}

/**
 * 获取认证配置（带内存缓存，应用生命周期内只请求一次）
 * 从 /zhao-common/v1/public/config 获取站点配置+认证配置+功能开关
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  if (cachedConfig) return cachedConfig

  try {
    const res = await request(`/zhao-common/v1/public/config?domain=${encodeURIComponent(SITE_DOMAIN)}`) as any
    const data = res?.data ?? res

    const config: AuthConfig = {
      // 站点信息
      siteName: data.site?.siteName ?? DEFAULT_CONFIG.siteName,
      siteDescription: data.site?.siteDescription ?? DEFAULT_CONFIG.siteDescription,
      logo: data.site?.logo ?? DEFAULT_CONFIG.logo,
      favicon: data.site?.favicon ?? DEFAULT_CONFIG.favicon,
      shareTitle: data.site?.shareTitle ?? DEFAULT_CONFIG.shareTitle,
      shareDescription: data.site?.shareDescription ?? DEFAULT_CONFIG.shareDescription,
      shareImage: resolveMediaUrl(data.site?.shareImage),
      sharePath: data.site?.sharePath ?? DEFAULT_CONFIG.sharePath,

      // 海报兜底配置
      posterDefaultUserName: data.site?.posterDefaultUserName ?? DEFAULT_CONFIG.posterDefaultUserName,
      posterDefaultUserAvatar: resolveMediaUrl(data.site?.posterDefaultUserAvatar) || DEFAULT_CONFIG.posterDefaultUserAvatar,
      posterDefaultRecommendReason: data.site?.posterDefaultRecommendReason ?? DEFAULT_CONFIG.posterDefaultRecommendReason,

      // 认证配置
      mode: data.auth?.mode ?? DEFAULT_CONFIG.mode,
      authMode: data.auth?.mode ?? DEFAULT_CONFIG.authMode,
      methods: data.auth?.methods ?? DEFAULT_CONFIG.methods,
      ssoLoginUrl: data.auth?.ssoLoginUrl ?? DEFAULT_CONFIG.ssoLoginUrl,
      ssoAppCode: data.auth?.ssoAppCode ?? DEFAULT_CONFIG.ssoAppCode,
      wechatOfficialAccountEnabled: data.auth?.wechatOfficialAccountEnabled ?? DEFAULT_CONFIG.wechatOfficialAccountEnabled,
      wechatMiniProgramEnabled: data.auth?.wechatMiniProgramEnabled ?? DEFAULT_CONFIG.wechatMiniProgramEnabled,
      wechatOpenPlatformEnabled: data.auth?.wechatOpenPlatformEnabled ?? DEFAULT_CONFIG.wechatOpenPlatformEnabled,
      alipayEnabled: data.auth?.alipayEnabled ?? DEFAULT_CONFIG.alipayEnabled,
      douyinEnabled: data.auth?.douyinEnabled ?? DEFAULT_CONFIG.douyinEnabled,
      thirdPartyEnabled: data.auth?.thirdPartyEnabled ?? DEFAULT_CONFIG.thirdPartyEnabled,
      ssoEnabled: data.auth?.ssoEnabled ?? DEFAULT_CONFIG.ssoEnabled,
      registerEnabled: data.auth?.registerEnabled ?? DEFAULT_CONFIG.registerEnabled,
      inviteCodeRequired: data.auth?.inviteCodeRequired ?? DEFAULT_CONFIG.inviteCodeRequired,

      // 功能开关
      pointsEnabled: data.featureFlags?.points !== false,
      signInPoints: data.points?.signInPoints ?? DEFAULT_CONFIG.signInPoints,
      coursePreviewEnabled: data.featureFlags?.coursePreviewEnabled ?? DEFAULT_CONFIG.coursePreviewEnabled,
      lessonProgressEnabled: data.featureFlags?.lessonProgressEnabled ?? DEFAULT_CONFIG.lessonProgressEnabled,
      channelInviteEnabled: data.featureFlags?.channelInviteEnabled ?? DEFAULT_CONFIG.channelInviteEnabled,
      allowCrossChannel: data.featureFlags?.allowCrossChannel ?? DEFAULT_CONFIG.allowCrossChannel,

      // 模块开关 + 当前租户模块授权
      exam: data.featureFlags?.exam ?? DEFAULT_CONFIG.exam,
      activity: data.featureFlags?.activity ?? DEFAULT_CONFIG.activity,
      roleGate: data.featureFlags?.roleGate ?? DEFAULT_CONFIG.roleGate,
      moduleGranted: {
        exam: data.moduleGrantedForCurrentTenant?.exam ?? DEFAULT_CONFIG.moduleGranted.exam,
        activity: data.moduleGrantedForCurrentTenant?.activity ?? DEFAULT_CONFIG.moduleGranted.activity,
        course: data.moduleGrantedForCurrentTenant?.course ?? DEFAULT_CONFIG.moduleGranted.course,
      },

      // 主题配置
      theme: data.theme,
    }

    cachedConfig = config

    // 应用主题（成功获取 config 后调用）
    if (config.theme) {
      applyTheme(config.theme)
    }

    return config
  } catch (e) {
    console.warn('[auth-config] 获取认证配置失败，使用默认配置:', e)
    notifyServiceUnavailable()
    return { ...DEFAULT_CONFIG, methods: [...DEFAULT_CONFIG.methods] }
  }
}

/**
 * 清除缓存（用于强制刷新）
 */
export function clearAuthConfigCache(): void {
  cachedConfig = null
}

/**
 * 从 storage 读取缓存的认证配置（同步）
 * App onLaunch 时已将配置存入 storage
 */
export function getStoredAuthConfig(): AuthConfig | null {
  try {
    const stored = uni.getStorageSync('authConfig')
    if (stored) {
      return JSON.parse(stored) as AuthConfig
    }
  } catch {
    // ignore
  }
  return null
}
