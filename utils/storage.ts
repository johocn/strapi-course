const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const POINTS_KEY = 'points'

// 通用的存储操作函数
export function getStorage(key: string): any {
  const value = uni.getStorageSync(key)
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return value
  }
}

export function setStorage(key: string, value: any): void {
  if (typeof value === 'string') {
    uni.setStorageSync(key, value)
  } else {
    uni.setStorageSync(key, JSON.stringify(value))
  }
}

export function removeStorage(key: string): void {
  uni.removeStorageSync(key)
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return uni.getStorageSync(TOKEN_KEY) ?? null
}

export function removeToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

export function setUser(user: any) {
  uni.setStorageSync(USER_KEY, JSON.stringify(user))
}

export function saveUser(user: any): void {
  setUser(user)
}

export function getUser(): any | null {
  const user = uni.getStorageSync(USER_KEY)
  return user ? JSON.parse(user) : null
}

export function removeUser() {
  uni.removeStorageSync(USER_KEY)
}

export function setPoints(points: number) {
  uni.setStorageSync(POINTS_KEY, points)
}

export function getPoints(): number {
  return uni.getStorageSync(POINTS_KEY) ?? 0
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function logout() {
  removeToken()
  removeUser()
  setPoints(0)
  // 清理 SSO token 刷新相关数据
  uni.removeStorageSync('refresh_token')
  uni.removeStorageSync('token_expires_at')
  uni.removeStorageSync('inviteCode')
  uni.removeStorageSync('channelInviteCode')
  uni.removeStorageSync('wxAuthAppType')
}

export function getLoginState() {
  return {
    isLoggedIn: isLoggedIn(),
    token: getToken(),
    user: getUser()
  }
}

export interface LoginState {
  token: string
  user: {
    id: string
    name: string
    avatar?: string
    openid?: string
    unionid?: string
  }
}

export function setLoginState(state: LoginState) {
  setToken(state.token)
  setUser(state.user)
}

export function clearLoginState() {
  logout()
}
