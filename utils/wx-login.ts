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
 * 微信新版 getUserProfile API，同时获取 encryptedData/iv 发送到后端
 */
export async function authorizeLogin(): Promise<{ nickname: string; avatar: string }> {
  return new Promise((resolve, reject) => {
    uni.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        const { nickName, avatarUrl } = res.userInfo
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
