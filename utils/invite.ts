/**
 * 邀请码和分享功能
 */
import { getToken, getUser, setUser } from './storage'
import { BASE_API } from './env'
import { getStoredAuthConfig } from '../services/auth-config'

// 获取用户邀请码
function getInviteCode(): string {
  const user = getUser()
  if (user && user.inviteCode) {
    return user.inviteCode
  }
  // 如果没有邀请码，生成一个基于用户ID的邀请码
  const userId = user?.id ?? 'guest'
  return generateInviteCode(userId)
}

// 生成邀请码
function generateInviteCode(userId: string): string {
  // 基于用户ID生成6位邀请码
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0)
  }, 0)
  const code = (hash % 900000 + 100000).toString()
  return `SL${code}`
}

// 保存邀请码到用户信息
function saveInviteCode(inviteCode: string): void {
  const user = getUser()
  if (user) {
    user.inviteCode = inviteCode
    setUser(user)
  }
}

// 识别邀请码类型（用户邀请码 vs 渠道邀请码）
function identifyInviteCode(code: string): { type: 'user' | 'channel' | 'unknown', code: string } {
  if (!code) return { type: 'unknown', code: '' }

  // 渠道邀请码特征：channel_、ch_ 前缀，或纯数字（渠道code）
  if (code.startsWith('channel_') || code.startsWith('ch_')) {
    return { type: 'channel', code: code.replace(/^channel_|^ch_/, '') }
  }

  // 用户邀请码特征：invite_、inv_ 前缀，或SL开头
  if (code.startsWith('invite_') || code.startsWith('inv_')) {
    return { type: 'user', code: code.replace(/^invite_|^inv_/, '') }
  }

  // 默认：SL开头的为用户邀请码，其他为渠道邀请码
  if (code.startsWith('SL')) {
    return { type: 'user', code }
  }

  return { type: 'channel', code }
}

// 存储邀请码（区分类型）
function storeInviteCode(code: string): void {
  console.log('[invite] Storing invite code:', code)

  const identified = identifyInviteCode(code)

  if (identified.type === 'channel') {
    uni.setStorageSync('channelInviteCode', identified.code)
    console.log('[invite] Stored as channel invite code')
  } else if (identified.type === 'user') {
    uni.setStorageSync('inviteCode', identified.code)
    console.log('[invite] Stored as user invite code')
  }
}

// 处理邀请链接参数（支持用户邀请码和渠道邀请码）
function handleInviteLink(): void {
  // #ifdef H5
  // H5环境：从URL参数读取
  const urlParams = new URLSearchParams(window.location.search)
  const hashQuery = window.location.hash.split('?')[1] ?? ''
  const hashParams = new URLSearchParams(hashQuery)

  // 兼容三种命名变体：
  //   - camelCase：inviteCode / channelCode（小程序分享、内部跳转）
  //   - lowercase：invitecode / channelcode（channel/detail.vue 生成的二维码链接）
  //   - snake_case：invite_code / channel_code（SSO 流程透传参数）
  const inviteCodeFromUrl =
    urlParams.get('inviteCode') || urlParams.get('invitecode') || urlParams.get('invite_code') ||
    hashParams.get('inviteCode') || hashParams.get('invitecode') || hashParams.get('invite_code')
  const channelCodeFromUrl =
    urlParams.get('channelCode') || urlParams.get('channelcode') || urlParams.get('channel_code') ||
    hashParams.get('channelCode') || hashParams.get('channelcode') || hashParams.get('channel_code')

  if (inviteCodeFromUrl) {
    storeInviteCode(inviteCodeFromUrl)
    // 清除URL参数
    const cleanUrl = window.location.pathname + window.location.hash.split('?')[0]
    window.history.replaceState({}, '', cleanUrl)
  }

  if (channelCodeFromUrl) {
    storeInviteCode(channelCodeFromUrl)
    // 清除URL参数
    const cleanUrl = window.location.pathname + window.location.hash.split('?')[0]
    window.history.replaceState({}, '', cleanUrl)
  }
  // #endif

  // #ifdef MP-WEIXIN
  // 微信小程序：从页面参数或场景值读取
  const pages = getCurrentPages()
  if (pages.length > 0) {
    const currentPage = pages[pages.length - 1]
    const options = (currentPage as any)?.options ?? {}

    // 保存邀请码（同时兼容 inviteCode 与 invite_code 两种命名）
    const mpInviteCode = options.inviteCode || options.invite_code
    if (mpInviteCode) {
      storeInviteCode(mpInviteCode)
      console.log('保存邀请码:', mpInviteCode)
    }

    // 保存渠道邀请码（同时兼容 channelCode 与 channel_code 两种命名）
    const mpChannelCode = options.channelCode || options.channel_code
    if (mpChannelCode) {
      storeInviteCode(mpChannelCode)
      console.log('保存渠道邀请码:', mpChannelCode)
    }

    // 保存邀请人ID
    if (options.inviterId) {
      uni.setStorageSync('inviterId', options.inviterId)
    }
  }

  // 处理小程序场景值（扫码进入）
  try {
    const launchOptions = uni.getLaunchOptionsSync()
    if (launchOptions && launchOptions.scene) {
      // 场景值：1047（扫码）、1048（长按图片）、1049（分享卡片）
      if (launchOptions.scene === 1047 || launchOptions.scene === 1048 || launchOptions.scene === 1049) {
        const query = launchOptions.query ?? {}
        const scene = query.scene ?? ''

        if (scene) {
          // 解析scene参数
          const decoded = decodeURIComponent(scene)
          const sceneParams = new URLSearchParams(decoded)
          const inviteCodeFromScene = sceneParams.get('inviteCode') || sceneParams.get('channelCode')

          if (inviteCodeFromScene) {
            storeInviteCode(inviteCodeFromScene)
            console.log('从场景值保存邀请码:', inviteCodeFromScene)
          } else if (decoded && !decoded.includes('=')) {
            // 如果scene不是参数格式，直接作为邀请码
            storeInviteCode(decoded)
            console.log('从场景值保存邀请码（直接）:', decoded)
          }
        }
      }
    }
  } catch (e) {
    console.warn('[invite] Failed to get launch options:', e)
  }
  // #endif
}

// 获取分享路径（带邀请码）
function getSharePath(page: string = '/pages/index/index'): string {
  const inviteCode = getInviteCode()
  const userId = getUser()?.id ?? ''
  
  // 构建带邀请码的路径
  let path = page
  if (inviteCode) {
    path += `?inviteCode=${inviteCode}`
  }
  if (userId) {
    path += `&inviterId=${userId}`
  }
  
  return path
}

// 微信分享到好友
function shareToFriend(params?: { title?: string; path?: string; imageUrl?: string }): void {
  // #ifdef MP-WEIXIN
  // 小程序分享通过 onShareAppMessage 生命周期实现
  // 这里只是提示用户如何分享
  uni.showToast({
    title: '点击右上角分享给好友',
    icon: 'none'
  })
  // #endif
  
  // #ifndef MP-WEIXIN
  uni.showToast({
    title: '请在微信小程序中使用此功能',
    icon: 'none'
  })
  // #endif
}

// 微信分享到朋友圈
function shareToTimeline(params?: { title?: string; query?: string; imageUrl?: string }): void {
  // #ifdef MP-WEIXIN
  // 小程序分享朋友圈通过 onShareTimeline 生命周期实现
  uni.showToast({
    title: '点击右上角分享到朋友圈',
    icon: 'none'
  })
  // #endif
  
  // #ifndef MP-WEIXIN
  uni.showToast({
    title: '请在微信小程序中使用此功能',
    icon: 'none'
  })
  // #endif
}

// 获取分享配置（用于页面 onShareAppMessage）
function getShareConfig(page?: string): {
  title: string
  path: string
  imageUrl: string
} {
  const inviteCode = getInviteCode()
  
  return {
    title: getStoredAuthConfig()?.shareTitle ?? '学习课程，答题赢积分',
    path: getSharePath(page ?? '/pages/index/index'),
    imageUrl: '/static/share-image.png'
  }
}

// 获取朋友圈分享配置（用于页面 onShareTimeline）
function getTimelineConfig(): {
  title: string
  query: string
  imageUrl: string
} {
  const inviteCode = getInviteCode()
  
  return {
    title: getStoredAuthConfig()?.shareTitle ?? '学习课程，答题赢积分',
    query: `inviteCode=${inviteCode}`,
    imageUrl: '/static/share-image.png'
  }
}

// 显示分享引导弹窗
function showShareGuide(): void {
  uni.showModal({
    title: '分享给好友',
    content: '点击右上角「...」按钮，选择「发送给朋友」或「分享到朋友圈」，邀请好友一起学习！好友通过您的邀请注册后，您可获得额外积分奖励。',
    showCancel: false,
    confirmText: '知道了'
  })
}

// 记录邀请关系
async function recordInvite(inviteCode: string, inviterId: string): Promise<void> {
  try {
    const token = getToken()
    const headers: any = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    // 调用后端接口记录邀请关系
    await uni.request({
      url: `${BASE_API}/zhao-user/v1/invite`,
      method: 'POST',
      header: headers,
      data: {
        inviteCode,
        inviterId,
        inviteeId: getUser()?.id
      }
    })
    console.log('邀请关系记录成功')
  } catch (e) {
    console.error('邀请关系记录失败', e)
  }
}

// 检查是否是被邀请用户
function checkInvitedUser(): boolean {
  const inviteCode = uni.getStorageSync('inviteCode')
  const inviterId = uni.getStorageSync('inviterId')
  return !!inviteCode && !!inviterId
}

export {
  getInviteCode,
  generateInviteCode,
  saveInviteCode,
  identifyInviteCode,
  storeInviteCode,
  handleInviteLink,
  getSharePath,
  shareToFriend,
  shareToTimeline,
  getShareConfig,
  getTimelineConfig,
  showShareGuide,
  recordInvite,
  checkInvitedUser
}

// ==================== 邀请码兜底绑定 ====================

/**
 * 登录/回调成功后兜底建立分销关系
 * - inviteCode（用户邀请码，来自 v.joho.cn）→ useInviteCode（/user-invites/use）
 * - channelInviteCode（渠道邀请码，来自 h.joho.cn）→ joinChannelByInvite（/channel-invite/join，幂等）
 *
 * 调用方：
 * - login.vue 本地登录成功后
 * - auth-callback.vue SSO/third 回调成功后
 *
 * 策略：成功才清除 storage，失败保留下次再试
 */
export async function bindInviteCodesAfterLogin(): Promise<void> {
  const inviteCode = uni.getStorageSync('inviteCode') || ''
  const channelInviteCode = uni.getStorageSync('channelInviteCode') || ''

  // 用户邀请码 → useInviteCode
  if (inviteCode) {
    try {
      const { useInviteCode } = await import('../services/api')
      await useInviteCode(inviteCode)
      uni.removeStorageSync('inviteCode')
      console.log('[invite] 用户邀请码绑定成功:', inviteCode)
    } catch (e) {
      console.warn('[invite] 绑定用户邀请码失败，保留 storage:', e)
    }
  }

  // 渠道邀请码 → joinChannelByInvite（后端幂等，已存在则返回 isNewMember: false）
  if (channelInviteCode) {
    try {
      const { joinChannelByInvite } = await import('../services/api')
      await joinChannelByInvite(channelInviteCode)
      uni.removeStorageSync('channelInviteCode')
      console.log('[invite] 渠道邀请码绑定成功:', channelInviteCode)
    } catch (e) {
      console.warn('[invite] 加入渠道失败，保留 storage:', e)
    }
  }
}