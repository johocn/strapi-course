// API 接口定义 - 后端统一返回 { data, meta } 格式
import { getToken, removeToken, removeUser, setPoints } from '../utils/storage'
import { BASE_API } from '../utils/env'

// 无需 token 的公开路由
const PUBLIC_ROUTES = [
  '/zhao-third/v1/third/callback',              // 三方登录回调
  '/zhao-third/v1/third/jssdk-signature',        // JS-SDK 签名（公开）
  '/zhao-third/v1/third/qrconnect-url',          // 开放平台扫码URL（公开）
  '/zhao-third/v1/third/config',                 // 三方公开配置
  '/zhao-third/v1/third/auth-url',               // 开放平台授权URL（公开）
  '/v1/auth/login',                   // SSO 登录
  '/v1/auth/register',               // 注册
  '/v1/auth/reset-password',         // 重置密码
  '/zhao-sso/v1/auth/',              // SSO 认证（兼容旧路由）
  '/zhao-sso/v1/oauth/',             // OAuth（兼容旧路由）
  '/zhao-common/v1/public',          // 公共配置
  '/zhao-point/v1/point/products',   // 商品列表（游客可看）
  '/zhao-point/v1/point/rules',      // 积分规则（游客可看）
  '/zhao-point/v1/point/pickup-locations', // 自提点（游客可看）
  '/zhao-point/v1/point/exchange-rate', // 兑换比率（游客可看）
  '/zhao-point/v1/point/feature-flags',   // 特性开关（游客可看）
  '/zhao-course/v1/courses',         // 课程公开列表
  '/zhao-course/v1/course-categories', // 课程分类
  '/zhao-quiz/v1/public',            // 题库公开接口
  '/zhao-quiz/v1/questions',         // 题库（游客可看）
  '/zhao-auth/v1/auth/config',      // 认证配置
  '/zhao-auth/v1/login',            // 本地登录
  '/zhao-auth/v1/register',         // 注册
  '/zhao-auth/v1/reset-password',   // 重置密码
]

function isPublicRoute(url: string): boolean {
  return PUBLIC_ROUTES.some(route => url.startsWith(route))
}

let isHandlingUnauthorized = false

function handleUnauthorized() {
  removeToken()
  removeUser()
  setPoints(0)
  uni.removeStorageSync('inviteCode')
  uni.removeStorageSync('channelInviteCode')
  uni.removeStorageSync('wxAuthAppType')
  uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/login' })
  }, 1500)
}

export async function request(url: string, options: any = {}) {
  const token = getToken()

  // 非公开路由必须有 token
  if (!token && !isPublicRoute(url)) {
    handleUnauthorized()
    throw new Error('未登录')
  }

  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  try {
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: `${BASE_API}${url}`,
        method: options.method ?? 'GET',
        data: options.data,
        header: headers,
        success: (res: any) => {
          // 401 未授权，跳转登录
          if (res.statusCode === 401) {
            if (!isHandlingUnauthorized) {
              isHandlingUnauthorized = true
              handleUnauthorized()
              setTimeout(() => { isHandlingUnauthorized = false }, 2000)
            }
            reject(new Error('登录已过期'))
            return
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(res.data)
          }
        },
        fail: (err: any) => {
          reject(err)
        }
      })
    })
    return res
  } catch (e) {
    console.error('API请求失败:', e)
    throw e
  }
}

// ==================== 三方登录 API ====================

export async function wxMiniProgramLogin(code: string, encryptedData?: string, iv?: string, inviteCode?: string, channelInviteCode?: string) {
  return request('/zhao-third/v1/third/callback', {
    method: 'POST',
    data: { platform: 'wechat', appType: 'mini_program', code, encryptedData, iv, inviteCode, channelInviteCode },
  })
}

export async function getThirdPartyPublicConfig(platform: string, appType: string) {
  return request(`/zhao-third/v1/third/config/${platform}/${appType}`)
}

export async function updateThirdPartyProfile(platform: string, appType: string, nickname?: string, avatar?: string) {
  return request('/zhao-third/v1/third/profile/update', {
    method: 'POST',
    data: { platform, appType, nickname, avatar },
  })
}

// ==================== 微信 JS-SDK ====================

export async function getJSSDKSignature(url: string) {
  return request('/zhao-third/v1/third/jssdk-signature', {
    method: 'POST',
    data: { url }
  })
}

// ==================== 微信开放平台扫码登录 ====================

export async function getQrconnectUrl(redirectUrl: string) {
  return request('/zhao-third/v1/third/qrconnect-url', {
    method: 'POST',
    data: { redirectUrl },
  })
}

export async function getOpenPlatformAuthUrl(redirectUrl: string) {
  return request('/zhao-third/v1/third/auth-url', {
    method: 'POST',
    data: {
      platform: 'wechat',
      appType: 'open_platform',
      redirectUrl,
    },
  })
}

// ==================== 课程相关 API ====================

export async function getCourseList(params?: { 
  page?: number; 
  pageSize?: number; 
  category?: string;
  tags?: string;
  q?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const queryParams: Record<string, any> = {}
  
  if (params?.category && params.category !== 'all') {
    queryParams['filters[category][documentId][$eq]'] = params.category
  }
  if (params?.q) {
    queryParams['filters[title][$containsi]'] = params.q
  }
  if (params?.page) queryParams['pagination[page]'] = params.page
  if (params?.pageSize) queryParams['pagination[pageSize]'] = params.pageSize
  
  const query = new URLSearchParams(queryParams).toString()
  return request(`/zhao-course/v1/courses${query ? '?' + query : ''}`)
}

export async function getCourseCategories() {
  return request('/zhao-course/v1/course-categories')
}

export async function getCourseDetail(documentId: string) {
  const res = await request(`/zhao-course/v1/courses/${documentId}`)
  return res?.data ?? res
}

export async function getMyCourses() {
  return request('/zhao-course/v1/my/courses', { method: 'GET' })
}

export async function getMyCourseProgresses() {
  return request('/zhao-course/v1/my/course-progresses', { method: 'GET' })
}

export async function getLessonList(courseId: string) {
  const params = new URLSearchParams()
  params.append('filters[course][documentId][$eq]', courseId)
  params.append('sort', 'sequenceNumber:asc')
  return request(`/zhao-course/v1/course-lessons?${params.toString()}`)
}

export async function getLessonDetail(documentId: string) {
  const res = await request(`/zhao-course/v1/course-lessons/${documentId}`)
  return res?.data ?? res
}

export async function submitLessonProgress(data: { lessonDocumentId: string; progress: number; playPosition?: number; duration?: number }) {
  const res = await request('/zhao-course/v1/my/lesson-progress', {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

export async function getMyLessonProgresses(courseId?: string) {
  const query = courseId ? `?course=${courseId}` : ''
  return request(`/zhao-course/v1/my/lesson-progresses${query}`)
}

export async function claimLessonPoints(progressId: string | number, data: { selectedChannelId?: number | string } = {}) {
  const res = await request(`/zhao-course/v1/my/claim-lesson-points/${progressId}`, {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

// ==================== 测验相关 API ====================

export async function getQuizByLesson(lessonId: string) {
  const params = new URLSearchParams()
  params.append('filters[lesson][documentId][$eq]', lessonId)
  params.append('filters[isPublished][$eq]', 'true')
  return request(`/zhao-quiz/v1/quizzes?${params.toString()}`)
}

export async function startQuiz(data: { lessonDocumentId: string; count?: number }) {
  const res = await request('/zhao-quiz/v1/my/quiz/start', {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

export async function checkQuizAnswer(data: { quizDocumentId: string; userAnswer: string }) {
  const res = await request('/zhao-quiz/v1/my/quiz/check-answer', {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

export async function claimQuizPoints(data: {
  courseDocumentId: string
  totalEarnedPoints: number
  lessonDocumentId?: string
  selectedChannelId?: number | string
}) {
  const res = await request('/zhao-quiz/v1/my/quiz/claim-points', {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

export async function submitQuizAnswer(progressId: string, isCorrect: boolean) {
  const res = await request(`/zhao-course/v1/my/lesson-answer/${progressId}`, {
    method: 'POST',
    data: { isCorrect }
  })
  return res?.data ?? res
}

export async function getQuizRecord(params?: { user?: string; course?: string; lesson?: string }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-quiz/v1/quiz-record${query ? '?' + query : ''}`)
}

export async function getMyQuizRecords(courseDocumentId?: string) {
  const query = courseDocumentId ? `?courseDocumentId=${courseDocumentId}` : ''
  const res = await request(`/zhao-quiz/v1/my/quiz-records${query}`)
  return (res as any)?.data ?? res
}

// ==================== 积分相关 API ====================

export async function getPointBalance() {
  const res = await request('/zhao-point/v1/my/point/balance')
  return res?.data ?? res
}

export async function getPointRecordList(params?: { page?: number; pageSize?: number; type?: string; action?: string }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-point/v1/my/point/records${query ? '?' + query : ''}`)
}

export async function earnPoints(points: number, source: string = 'quiz') {
  const res = await request('/zhao-point/v1/admin/point/earn', {
    method: 'POST',
    data: { action: 'quiz_pass', source }
  })
  return res?.data ?? res
}

export async function getPointStatistics() {
  const res = await request('/zhao-point/v1/my/point/statistics')
  return res?.data ?? res
}

// 获取功能开关（公开，无需登录）
export async function getPointFeatureFlags() {
  const res = await request('/zhao-point/v1/point/feature-flags')
  return res?.data ?? res
}

// 签到
export async function signIn() {
  const res = await request('/zhao-point/v1/my/point/sign-in', { method: 'POST' })
  return res?.data ?? res
}

// 签到状态
export async function getSignInStatus() {
  const res = await request('/zhao-point/v1/my/point/sign-in/status')
  return res?.data ?? res
}

// 任务列表
export async function getPointTasks() {
  const res = await request('/zhao-point/v1/my/point/tasks')
  return res?.data ?? res
}

// ==================== 商品兑换相关 API ====================

export async function getPointProductList(params?: { status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams({ status: 'on_shelf', ...params } as any).toString()
  return request(`/zhao-point/v1/point/products${query ? '?' + query : ''}`)
}

export async function getPointProductDetail(id: string) {
  const res = await request(`/zhao-point/v1/point/products/${id}`)
  return res?.data ?? res
}

export async function redeemPoints(data: {
  productId: string;
  pointsCost: number;
  quantity: number;
  deliveryType: string;
  pickupLocationId?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  remark?: string;
  useGlobalPoints?: boolean;
  selectedChannels?: string[];
}) {
  const res = await request('/zhao-point/v1/my/point/redeem', {
    method: 'POST',
    data
  })
  return res?.data ?? res
}

export async function getRedemptionRecordList(params?: { status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-point/v1/my/point/redeem/records${query ? '?' + query : ''}`)
}

export async function getPointRules(params?: { action?: string; category?: string }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-point/v1/point/rules${query ? '?' + query : ''}`)
}

// ==================== 自提点相关 API ====================

export async function getPickupLocationList(params?: { channelId?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-point/v1/point/pickup-locations${query ? '?' + query : ''}`)
}

export async function getPickupLocationDetail(id: string) {
  const res = await request(`/zhao-point/v1/point/pickup-locations/${id}`)
  return res?.data ?? res
}

// ==================== 邀请分销相关 API ====================

export async function getInviteStats() {
  const res = await request('/zhao-channel/v1/my/invite/stats')
  return res?.data ?? res
}

export async function getInviteChain() {
  return request('/zhao-channel/v1/my/invite/chain')
}

export async function getInviteDownstream() {
  return request('/zhao-channel/v1/my/invite/downstream')
}

export async function useInviteCode(code: string) {
  const res = await request('/zhao-channel/v1/user-invites/use', {
    method: 'POST',
    data: { code }
  })
  return res?.data ?? res
}

export async function joinChannelByInvite(inviteCode: string) {
  const res = await request('/zhao-channel/v1/channel-invite/join', {
    method: 'POST',
    data: { inviteCode }
  })
  return res?.data ?? res
}

export async function validateInviteCode(code: string) {
  const res = await request('/zhao-channel/v1/user-invites/validate', {
    method: 'POST',
    data: { code }
  })
  return res?.data ?? res
}

// ==================== 用户相关 API ====================

export async function getUserInfo() {
  const res = await request('/users/me')
  return res?.data ?? res
}

export async function login(phone: string, code: string) {
  return request('/zhao-auth/v1/login', {
    method: 'POST',
    data: { identifier: phone, password: code }
  })
}

export async function loginWithPassword(username: string, password: string) {
  return request('/zhao-auth/v1/login', {
    method: 'POST',
    data: { identifier: username, password }
  })
}

export async function register(data: {
  username: string
  email: string
  password: string
  inviteCode?: string
  channelInviteCode?: string
}) {
  return request('/zhao-auth/v1/register', {
    method: 'POST',
    data: {
      username: data.username,
      email: data.email,
      password: data.password,
      inviteCode: data.inviteCode,
      channelInviteCode: data.channelInviteCode
    }
  })
}

// 类型定义
export interface Course {
  documentId: string
  title: string
  description?: string
  coverUrl?: string
  cover?: any
  category?: { name: string } | null
  tags?: Array<{ name: string }>
  createdAt?: string
  status?: string
  isPaid?: boolean
  isFree?: boolean
  enablePoints?: boolean
  points?: number
  difficulty?: string
  level?: string
  duration?: string
  author?: string
  studentCount?: number
  viewCount?: number
  rating?: number
}

export interface Lesson {
  documentId: string
  title: string
  duration: number
  completed?: boolean
  progress?: number
}

export interface QuizQuestion {
  documentId: string
  title: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer'
  options?: Array<{ key: string; text: string }>
  answer: string | string[]
  explanation?: string
  points?: number
}

export interface PointRecord {
  id: string
  action: 'earn' | 'spend'
  points: number
  description: string
  createdAt: string
}

export interface PointProduct {
  id: string
  name: string
  points: number
  stock: number
  deliveryType: string
  image?: string
}

export interface RedemptionRecord {
  id: string
  productName: string
  points: number
  status: 'pending' | 'shipped' | 'completed' | 'cancelled'
  createdAt: string
}
