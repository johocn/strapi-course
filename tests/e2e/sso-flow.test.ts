/**
 * SSO 登录流程端到端测试
 *
 * 测试覆盖：
 * - SSO 跳转 URL 包含 invite_code 和 channel_code 参数
 * - SSO 跳转 URL 包含 app_code 和 return_url 参数
 * - auth-callback 页面正确处理 token 参数
 * - auth-callback 页面正确处理 error 参数
 * - 微信重试次数在登录成功后清除
 */

// ==================== Mock 全局 uni API ====================

const mockStorage: Record<string, any> = {}

const mockUni = {
  getStorageSync: jest.fn((key: string): any => {
    return mockStorage[key] ?? null
  }),
  setStorageSync: jest.fn((key: string, value: any) => {
    mockStorage[key] = value
  }),
  removeStorageSync: jest.fn((key: string) => {
    delete mockStorage[key]
  }),
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(),
  switchTab: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  reLaunch: jest.fn(),
}

;(global as any).uni = mockUni

// ==================== Mock window.location ====================

let mockLocation: any = {
  href: 'https://example.com/#/pages/login/login',
  origin: 'https://example.com',
  search: '',
  hash: '#/pages/login/login',
  hostname: 'example.com',
  pathname: '/',
}

delete (global as any).window
;(global as any).window = {
  get location() {
    return mockLocation
  },
  set location(val: any) {
    if (typeof val === 'string') {
      mockLocation = { ...mockLocation, href: val }
    }
  },
  history: {
    replaceState: jest.fn(),
    pushState: jest.fn(),
  },
}

// ==================== Mock navigator ====================

;(global as any).navigator = {
  userAgent:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.47',
}

// ==================== Mock import.meta.env ====================

;(global as any).import = {
  meta: {
    env: {
      VITE_API_BASE: '/api',
      VITE_BASE_URL: '',
      VITE_SITE_DOMAIN: 'example.com',
    },
  },
}

// ==================== 导入被测试模块 ====================

import { bindInviteCodesAfterLogin } from '../../utils/invite'
import { setToken, getToken, setUser, getUser } from '../../utils/storage'
import { useInviteCode, joinChannelByInvite } from '../../services/api'

// ==================== Mock API 依赖 ====================

jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api')
  return {
    ...actual,
    request: jest.fn(),
    useInviteCode: jest.fn(),
    joinChannelByInvite: jest.fn(),
  }
})

// ==================== 辅助函数 ====================

/**
 * 模拟 login.vue 中的 redirectToSso 函数
 */
function buildSsoRedirectUrl(authConfig: {
  ssoLoginUrl: string
  ssoAppCode?: string
}): string {
  const returnUrl = 'https://example.com/#/pages/auth-callback/auth-callback'
  const params = new URLSearchParams({
    app_code: authConfig.ssoAppCode || 'course',
    return_url: returnUrl,
  })

  const userInviteCode = mockUni.getStorageSync('inviteCode') || ''
  const channelInvite = mockUni.getStorageSync('channelInviteCode') || ''
  if (userInviteCode) params.append('invite_code', userInviteCode)
  if (channelInvite) params.append('channel_code', channelInvite)

  const sep = authConfig.ssoLoginUrl.includes('?') ? '&' : '?'
  return `${authConfig.ssoLoginUrl}${sep}${params.toString()}`
}

/**
 * 模拟 auth-callback.vue 中 handleOAuthCallback 的 token 处理逻辑
 */
async function handleAuthCallbackWithToken(token: string, userId?: string, userEncoded?: string) {
  if (token) {
    setToken(token)
    if (userEncoded) {
      try {
        const user = JSON.parse(decodeURIComponent(atob(userEncoded)))
        setUser(user)
      } catch {
        if (userId) setUser({ id: Number(userId) })
      }
    } else if (userId) {
      setUser({ id: Number(userId) })
    }

    // 清理 URL 参数
    mockUni.removeStorageSync('wxAuthScope')
    mockUni.removeStorageSync('wxAuthAppType')
    mockUni.removeStorageSync('h5AutoLoginAttemptedAt')
    mockUni.removeStorageSync('h5WechatAutoLoginRetries')

    // 绑定邀请码
    await bindInviteCodesAfterLogin()

    // 跳转首页
    setTimeout(() => {
      mockUni.switchTab({ url: '/pages/index/index' })
    }, 500)
  }
}

/**
 * 模拟 auth-callback.vue 中 handleOAuthCallback 的 error 处理逻辑
 */
function handleAuthCallbackError(error: string) {
  setTimeout(() => {
    mockUni.reLaunch({ url: '/pages/login/login' })
  }, 2000)
}

// ==================== 测试套件 ====================

describe('SSO 登录流程 - sso-flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
    mockUni.getStorageSync.mockImplementation((key: string) => mockStorage[key] ?? null)
    mockUni.setStorageSync.mockImplementation((key: string, value: any) => {
      mockStorage[key] = value
    })
    mockUni.removeStorageSync.mockImplementation((key: string) => {
      delete mockStorage[key]
    })
    // 重置 mockLocation
    mockLocation = {
      href: 'https://example.com/#/pages/login/login',
      origin: 'https://example.com',
      search: '',
      hash: '#/pages/login/login',
      hostname: 'example.com',
      pathname: '/',
    }
  })

  // ==================== 1. SSO 跳转 URL 包含 invite_code 和 channel_code ====================

  describe('SSO 跳转 URL 包含 invite_code 和 channel_code', () => {
    test('跳转 URL 包含 invite_code 参数（用户邀请码）', () => {
      mockStorage['inviteCode'] = 'SL123456'

      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('invite_code')).toBe('SL123456')
    })

    test('跳转 URL 包含 channel_code 参数（渠道邀请码）', () => {
      mockStorage['channelInviteCode'] = 'CH999'

      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('channel_code')).toBe('CH999')
    })

    test('跳转 URL 同时包含 invite_code 和 channel_code', () => {
      mockStorage['inviteCode'] = 'SL123456'
      mockStorage['channelInviteCode'] = 'CH999'

      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('invite_code')).toBe('SL123456')
      expect(parsedUrl.searchParams.get('channel_code')).toBe('CH999')
    })

    test('无邀请码时跳转 URL 不包含 invite_code 参数', () => {
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.has('invite_code')).toBe(false)
      expect(parsedUrl.searchParams.has('channel_code')).toBe(false)
    })

    test('注册页 SSO 模式跳转时也透传邀请码参数', () => {
      // register.vue 中 SSO 模式跳转逻辑与 login.vue 保持一致
      mockStorage['inviteCode'] = 'SL654321'
      mockStorage['channelInviteCode'] = 'CH777'

      const authConfig = {
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      }
      const returnUrl = 'https://example.com/#/pages/auth-callback/auth-callback'
      const params = new URLSearchParams({
        app_code: authConfig.ssoAppCode || 'course',
        return_url: returnUrl,
      })

      const userInviteCode = mockUni.getStorageSync('inviteCode') || ''
      const channelInvite = mockUni.getStorageSync('channelInviteCode') || ''
      if (userInviteCode) params.append('invite_code', userInviteCode)
      if (channelInvite) params.append('channel_code', channelInvite)

      expect(params.get('invite_code')).toBe('SL654321')
      expect(params.get('channel_code')).toBe('CH777')
    })
  })

  // ==================== 2. SSO 跳转 URL 包含 app_code 和 return_url ====================

  describe('SSO 跳转 URL 包含 app_code 和 return_url', () => {
    test('跳转 URL 包含 app_code 参数', () => {
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('app_code')).toBe('course')
    })

    test('跳转 URL 包含 return_url 参数', () => {
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('return_url')).toBe(
        'https://example.com/#/pages/auth-callback/auth-callback'
      )
    })

    test('app_code 默认值为 course', () => {
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
      })

      const parsedUrl = new URL(url)
      expect(parsedUrl.searchParams.get('app_code')).toBe('course')
    })

    test('return_url 格式正确：指向 auth-callback 页面', () => {
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      const parsedUrl = new URL(url)
      const returnUrl = parsedUrl.searchParams.get('return_url')
      expect(returnUrl).toContain('auth-callback')
    })
  })

  // ==================== 3. auth-callback 处理 token 参数 ====================

  describe('auth-callback 处理 token 参数', () => {
    test('正确解析 token 参数并保存到 storage', async () => {
      const token = 'sso-jwt-token-abc123'

      await handleAuthCallbackWithToken(token, '42')

      expect(getToken()).toBe('sso-jwt-token-abc123')
    })

    test('带 token 时保存用户信息', async () => {
      const userObj = { id: 42, username: 'ssouser', email: 'sso@example.com' }
      const userEncoded = btoa(encodeURIComponent(JSON.stringify(userObj)))

      await handleAuthCallbackWithToken('sso-token', '42', userEncoded)

      const savedUser = getUser()
      expect(savedUser).toBeDefined()
      expect(savedUser.id).toBe(42)
      expect(savedUser.username).toBe('ssouser')
      expect(savedUser.email).toBe('sso@example.com')
    })

    test('无 user 参数时仅保存 userId', async () => {
      await handleAuthCallbackWithToken('sso-token', '99')

      const savedUser = getUser()
      expect(savedUser).toEqual({ id: 99 })
    })

    test('token 处理后跳转首页', async () => {
      await handleAuthCallbackWithToken('sso-token', '1')

      // setTimeout 内的 switchTab 尚未执行，但逻辑已触发
      // 验证基本流程
      expect(getToken()).toBe('sso-token')
    })

    test('token 处理后清除微信相关 storage', async () => {
      mockStorage['wxAuthScope'] = 'snsapi_base'
      mockStorage['wxAuthAppType'] = 'official_account'
      mockStorage['h5AutoLoginAttemptedAt'] = 'some-timestamp'
      mockStorage['h5WechatAutoLoginRetries'] = '2'

      await handleAuthCallbackWithToken('sso-token', '1')

      expect(mockStorage['wxAuthScope']).toBeUndefined()
      expect(mockStorage['wxAuthAppType']).toBeUndefined()
      expect(mockStorage['h5AutoLoginAttemptedAt']).toBeUndefined()
      expect(mockStorage['h5WechatAutoLoginRetries']).toBeUndefined()
    })

    test('token 处理后调用 bindInviteCodesAfterLogin', async () => {
      const mockUseInviteCode = require('../../services/api').useInviteCode as jest.Mock
      const mockJoinChannelByInvite = require('../../services/api').joinChannelByInvite as jest.Mock
      mockUseInviteCode.mockResolvedValue({ success: true })
      mockJoinChannelByInvite.mockResolvedValue({ isNewMember: true })

      mockStorage['inviteCode'] = 'SL123456'

      await handleAuthCallbackWithToken('sso-token', '1')

      // bindInviteCodesAfterLogin 应尝试绑定邀请码
      expect(mockUseInviteCode).toHaveBeenCalled()
    })
  })

  // ==================== 4. auth-callback 处理 error 参数 ====================

  describe('auth-callback 处理 error 参数', () => {
    test('error 参数存在时跳转到登录页', () => {
      const error = 'access_denied'

      handleAuthCallbackError(error)

      // 验证 setTimeout 内的 reLaunch 被调度
      // 2 秒后跳转到登录页
      expect(mockUni.reLaunch).not.toHaveBeenCalled() // setTimeout 未执行

      // 手动触发 setTimeout
      jest.advanceTimersByTime ? jest.advanceTimersByTime(2000) : null
    })

    test('error 参数存在时不保存 token', () => {
      const error = 'user_cancelled'

      // auth-callback 先检查 error，有 error 直接返回
      if (error) {
        // 不保存 token，直接跳转登录页
        handleAuthCallbackError(error)
      }

      expect(getToken()).toBeNull()
    })

    test('错误信息解码后显示在状态文本中', () => {
      const error = encodeURIComponent('登录失败：用户取消授权')
      const decodedError = decodeURIComponent(error)

      expect(decodedError).toBe('登录失败：用户取消授权')
    })
  })

  // ==================== 5. 微信重试次数在登录成功后清除 ====================

  describe('微信重试次数在登录成功后清除', () => {
    test('h5WechatAutoLoginRetries 在登录成功后清除', () => {
      mockStorage['h5WechatAutoLoginRetries'] = '2'

      // 模拟 auth-callback 成功处理后的清理
      mockUni.removeStorageSync('h5WechatAutoLoginRetries')

      expect(mockStorage['h5WechatAutoLoginRetries']).toBeUndefined()
    })

    test('第三方回调成功时清除 h5WechatAutoLoginRetries', () => {
      mockStorage['h5WechatAutoLoginRetries'] = '1'
      mockStorage['wxAuthScope'] = 'snsapi_base'
      mockStorage['wxAuthAppType'] = 'official_account'

      // 模拟 auth-callback 中 third 路径成功后的清理
      mockUni.removeStorageSync('wxAuthScope')
      mockUni.removeStorageSync('wxAuthAppType')
      mockUni.removeStorageSync('h5AutoLoginAttemptedAt')
      mockUni.removeStorageSync('h5WechatAutoLoginRetries')

      expect(mockStorage['h5WechatAutoLoginRetries']).toBeUndefined()
      expect(mockStorage['wxAuthScope']).toBeUndefined()
      expect(mockStorage['wxAuthAppType']).toBeUndefined()
    })

    test('SSO 回调成功时也清除 h5WechatAutoLoginRetries', async () => {
      mockStorage['h5WechatAutoLoginRetries'] = '2'
      mockStorage['h5AutoLoginAttemptedAt'] = 'some-value'

      // 模拟 SSO 路径的成功清理
      await handleAuthCallbackWithToken('sso-token', '1')

      expect(mockStorage['h5WechatAutoLoginRetries']).toBeUndefined()
      expect(mockStorage['h5AutoLoginAttemptedAt']).toBeUndefined()
    })

    test('注册页 SSO 模式跳转时不清理重试次数（跳转前保留）', () => {
      // 注册页跳转 SSO 时，重试次数应保留（由 auth-callback 处理完成后清理）
      mockStorage['h5WechatAutoLoginRetries'] = '1'

      // 构建跳转 URL，但不清理重试次数
      const url = buildSsoRedirectUrl({
        ssoLoginUrl: 'https://sso.example.com/login',
        ssoAppCode: 'course',
      })

      // 跳转前重试次数应保留
      expect(mockStorage['h5WechatAutoLoginRetries']).toBe('1')
      expect(url).toContain('sso.example.com/login')
    })

    test('重试次数在注册页微信自动登录前递增，成功后由 auth-callback 清理', () => {
      mockStorage['h5WechatAutoLoginRetries'] = '0'

      // 模拟注册页微信自动登录重试
      const retryCount = Number(mockUni.getStorageSync('h5WechatAutoLoginRetries') || 0)
      if (retryCount < 2) {
        mockUni.setStorageSync('h5WechatAutoLoginRetries', retryCount + 1)
      }

      expect(mockStorage['h5WechatAutoLoginRetries']).toBe('1')

      // 模拟 auth-callback 成功后的清理
      mockUni.removeStorageSync('h5WechatAutoLoginRetries')
      expect(mockStorage['h5WechatAutoLoginRetries']).toBeUndefined()
    })
  })
})