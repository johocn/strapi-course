/**
 * 认证中间件 - 处理页面访问控制和登录验证
 */
import { getToken, getUser, isLoggedIn } from './storage'

// 需要登录才能访问的页面
const authPages = [
  '/pages/video-player/video-player',
  '/pages/quiz/quiz',
  '/pages/points-record/points-record',
  '/pages/redeem-record/redeem-record',
  '/pages/my-course/my-course',
  '/pages/course-detail/course-detail',
  '/pages/exchange/exchange',
  '/pages/profile/profile'
]

// 检查页面是否需要登录
function isAuthPage(path: string): boolean {
  return authPages.some(page => path.includes(page))
}

// 检查用户是否已登录
function checkLogin(): { isLoggedIn: boolean; token: string | null; user: any } {
  return {
    isLoggedIn: isLoggedIn(),
    token: getToken(),
    user: getUser()
  }
}

// 验证登录状态
function validateLogin(): boolean {
  const { isLoggedIn: loggedIn, token } = checkLogin()
  
  if (!loggedIn || !token) {
    return false
  }
  
  // 可以在这里添加 token 过期检查
  // const tokenData = parseJWT(token)
  // if (tokenData && tokenData.exp * 1000 < Date.now()) {
  //   return false
  // }
  
  return true
}

// 跳转到登录页
function redirectToLogin(): void {
  uni.showToast({
    title: '请先登录',
    icon: 'none',
    duration: 1500
  })
  
  setTimeout(() => {
    uni.navigateTo({
      url: '/pages/login/login?redirect=' + encodeURIComponent(getCurrentPagePath())
    })
  }, 1500)
}

// 获取当前页面路径
function getCurrentPagePath(): string {
  const pages = getCurrentPages()
  if (pages.length > 0) {
    const currentPage = pages[pages.length - 1]
    return '/' + ((currentPage as any).route ?? '')
  }
  return ''
}

// 路由守卫 - 在 App.vue 的 onLaunch 或 onShow 中调用
function routeGuard(): void {
  const path = getCurrentPagePath()
  
  // 如果是登录页且已登录，跳转到首页
  if (path.includes('/pages/login/login')) {
    if (validateLogin()) {
      uni.switchTab({ url: '/pages/index/index' })
    }
    return
  }
  
  // 检查需要登录的页面
  if (isAuthPage(path)) {
    if (!validateLogin()) {
      redirectToLogin()
    }
  }
}

// 登录成功后调用，更新全局状态
function onLoginSuccess(token: string, user: any): void {
  uni.setStorageSync('token', token)
  uni.setStorageSync('user', JSON.stringify(user))
}

// 退出登录
function onLogout(): void {
  uni.removeStorageSync('token')
  uni.removeStorageSync('user')
  uni.removeStorageSync('points')
  
  uni.showToast({
    title: '已退出登录',
    icon: 'success'
  })
  
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/login' })
  }, 1000)
}

// 获取用户信息，如果未登录则返回 null
function getAuthUser(): any | null {
  if (!validateLogin()) {
    return null
  }
  return getUser()
}

// 获取 Token
function getAuthToken(): string | null {
  if (!validateLogin()) {
    return null
  }
  return getToken()
}

// 解析 JWT Token（可选）
function parseJWT(token: string): any | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

// 检查是否为游客模式
function isGuest(): boolean {
  return !isLoggedIn() && uni.getStorageSync('isGuest') === 'true'
}

// 导出
export {
  authPages,
  isAuthPage,
  checkLogin,
  validateLogin,
  isGuest,
  redirectToLogin,
  getCurrentPagePath,
  routeGuard,
  onLoginSuccess,
  onLogout,
  getAuthUser,
  getAuthToken,
  parseJWT
}
