/**
 * 微信小程序登录工具
 * 静默登录 + 可选授权登录
 */
import { wxMiniProgramLogin, getThirdPartyPublicConfig, updateThirdPartyProfile } from '../services/api'
import { setToken, setUser, getToken } from './storage'

let loginPromise: Promise<any> | null = null

/**
 * 微信小程序静默登录
 * 调用 wx.login 获取 code，发送到后端换取 token
 */
export async function silentLogin(inviteCode?: string, channelInviteCode?: string): Promise<{ token: string; user: any; isNewUser: boolean; requireAuth: boolean }> {
  // 防止并发登录
  if (loginPromise) return loginPromise

  loginPromise = _doSilentLogin(inviteCode, channelInviteCode)
  try {
    const result = await loginPromise
    return result
  } finally {
    loginPromise = null
  }
}

async function _doSilentLogin(inviteCode?: string, channelInviteCode?: string) {
  // 已有 token 则跳过
  const existingToken = getToken()
  if (existingToken) {
    return { token: existingToken, user: null, isNewUser: false, requireAuth: false }
  }

  // 1. 获取微信登录 code
  const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: resolve,
      fail: reject,
    })
  })

  const code = loginRes.code
  if (!code) {
    throw new Error('微信登录失败：无法获取 code')
  }

  // 2. 获取用户信息（可选，获取 encryptedData/iv）
  let encryptedData: string | undefined
  let iv: string | undefined

  // 3. 发送 code 到后端，携带邀请码和加密数据
  const result = await wxMiniProgramLogin(
    code,
    encryptedData,
    iv,
    inviteCode ?? uni.getStorageSync('inviteCode') ?? undefined,
    channelInviteCode ?? uni.getStorageSync('channelInviteCode') ?? undefined
  ) as any

  // 4. 存储 token 和用户信息
  if (result.token) {
    setToken(result.token)
  }
  if (result.user) {
    setUser(result.user)
  }

  // 5. 登录成功后清除邀请码
  if (result.token) {
    uni.removeStorageSync('inviteCode')
    uni.removeStorageSync('channelInviteCode')
  }

  // 6. 检查是否需要授权
  let requireAuth = false
  try {
    const config = await getThirdPartyPublicConfig('wechat', 'mini_program') as any
    requireAuth = config?.requireAuth === true
  } catch {
    // 配置不存在，默认不需要授权
  }

  return {
    token: result.token,
    user: result.user,
    isNewUser: result.isNewUser,
    requireAuth,
  }
}

/**
 * 授权登录 - 获取用户头像昵称
 *
 * ⚠️ 注意：wx.getUserProfile 自 2022-10-25 起被微信弃用，调用不再弹出授权弹窗，
 *    返回的 userInfo 固定为匿名数据（昵称 "微信用户" + 灰色默认头像）。
 *    encryptedData/iv 仍会返回但同样为匿名内容，写入后端会导致用户资料被覆盖为匿名值。
 *
 * 迁移方案（TODO）：改用 WeChat 新版头像昵称组件：
 *    - 头像：<button open-type="chooseAvatar" bind:chooseavatar>
 *    - 昵称：<input type="nickname">
 *  需新增授权弹窗页面，由用户主动点击触发，替代此处的自动调用。
 *
 * 当前兜底策略：检测到匿名数据时跳过后端写入，避免覆盖已有资料。
 */
export async function authorizeLogin(): Promise<{ nickname: string; avatar: string }> {
  return new Promise((resolve, reject) => {
    uni.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        const { nickName, avatarUrl } = res.userInfo
        // 检测微信弃用后的匿名返回数据，跳过写入避免覆盖
        const isAnonymous = nickName === '微信用户' || !avatarUrl || avatarUrl.includes('default_avatar')

        if (isAnonymous) {
          console.warn('[wx-login] getUserProfile 返回匿名数据（API 已弃用），跳过资料更新')
          resolve({ nickname: '', avatar: '' })
          return
        }

        // 如果有加密数据，发送到后端更新
        if (res.encryptedData && res.iv) {
          try {
            const loginRes = await new Promise<UniApp.LoginRes>((resolve2, reject2) => {
              uni.login({
                provider: 'weixin',
                success: resolve2,
                fail: reject2,
              })
            })
            if (loginRes.code) {
              await wxMiniProgramLogin(
                loginRes.code,
                res.encryptedData,
                res.iv,
              )
            }
          } catch {
            // 更新失败不影响登录
          }
        } else {
          // 旧版方式：直接更新昵称头像
          try {
            await updateThirdPartyProfile('wechat', 'mini_program', nickName, avatarUrl)
          } catch {
            // 更新失败不影响登录
          }
        }
        resolve({ nickname: nickName, avatar: avatarUrl })
      },
      fail: (err) => {
        reject(err)
      },
    })
  })
}

/**
 * 检查是否需要授权并执行授权流程
 */
export async function checkAndAuthorize(requireAuth: boolean): Promise<void> {
  if (!requireAuth) return

  try {
    const { nickname, avatar } = await authorizeLogin()
    // 更新本地用户信息
    const userStr = uni.getStorageSync('user')
    if (userStr) {
      const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
      user.name = nickname
      uni.setStorageSync('user', JSON.stringify(user))
    }
  } catch {
    // 用户拒绝授权，不影响使用
  }
}
