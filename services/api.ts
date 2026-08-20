// API 接口定义 - 后端统一返回 { data, meta } 格式
import { getToken, removeToken, removeUser, setPoints } from '../utils/storage'
import { BASE_API, SITE_DOMAIN } from '../utils/env'
import {
  buildCourseQuery,
  stringifyQuery,
  type CourseListParams
} from '../utils/course-query'

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
  '/zhao-course/v1/course-lessons',  // 课时公开列表
  '/zhao-course/v1/lessons',         // 课时公开列表（别名）
  '/zhao-quiz/v1/public',            // 题库公开接口
  '/zhao-quiz/v1/questions',         // 题库（游客可看）
  '/zhao-auth/v1/auth/config',      // 认证配置
  '/zhao-auth/v1/login',            // 本地登录
  '/zhao-auth/v1/register',         // 注册
  '/zhao-auth/v1/reset-password',   // 重置密码
  '/zhao-studio/v1/ads/',             // 广告展示（公开）
  '/zhao-studio/v1/posters/',         // 海报模板（公开）
  '/zhao-point/v1/activities',        // 线下活动列表/详情（游客可看）
]

function isPublicRoute(url: string): boolean {
  return PUBLIC_ROUTES.some(route => url.startsWith(route))
}

let isHandlingUnauthorized = false

function handleUnauthorized() {
  removeToken()
  removeUser()
  setPoints(0)
  uni.removeStorageSync('refresh_token')
  uni.removeStorageSync('token_expires_at')
  uni.removeStorageSync('inviteCode')
  uni.removeStorageSync('channelInviteCode')
  uni.removeStorageSync('wxAuthAppType')
  uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/login/login' })
  }, 1500)
}

// ===== Token 自动刷新机制 =====
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

/**
 * 检查 token 是否即将过期（提前 60 秒刷新）
 */
function isTokenExpiring(): boolean {
  const expiresAt = uni.getStorageSync('token_expires_at')
  if (!expiresAt) return false // 没有过期时间，不刷新
  return Date.now() >= Number(expiresAt)
}

/**
 * 刷新 token（使用 refresh_token 换取新的 access_token）
 * 返回新的 access_token，失败返回 null
 */
async function refreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise // 复用正在进行的刷新请求
  }

  const refreshTokenStr = uni.getStorageSync('refresh_token')
  if (!refreshTokenStr) return null

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res: any = await new Promise((resolve, reject) => {
        uni.request({
          url: `${BASE_API}/zhao-sso/v1/auth/refresh`,
          method: 'POST',
          data: { refresh_token: refreshTokenStr },
          header: { 'Content-Type': 'application/json' },
          success: (res: any) => resolve(res),
          fail: (err: any) => reject(err),
        })
      })

      if (res.statusCode === 200 && res.data) {
        const newToken = res.data.access_token || res.data.jwt || res.data.token
        const newRefreshToken = res.data.refresh_token || refreshTokenStr
        const expiresIn = res.data.expires_in || 900
        if (newToken) {
          uni.setStorageSync('token', newToken)
          uni.setStorageSync('refresh_token', newRefreshToken)
          uni.setStorageSync('token_expires_at', String(Date.now() + (expiresIn - 60) * 1000))
          console.log('[request] Token 刷新成功')
          return newToken
        }
      }
      // 刷新失败：后端已返回响应但非 200（401/404/500 等）→ refresh token 不可用，清除避免反复触发
      const errorMsg =
        typeof res.data?.error === 'string'
          ? res.data.error
          : res.data?.error?.message || ''
      console.warn('[request] Token 刷新失败:', res.statusCode, errorMsg)
      uni.removeStorageSync('refresh_token')
      uni.removeStorageSync('token_expires_at')
      return null
    } catch (e) {
      console.warn('[request] Token 刷新异常:', e)
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * 底层请求辅助函数（不处理认证逻辑）
 */
function doRequest(
  url: string,
  options: any,
  token: string | null
): Promise<{ statusCode: number; data: any }> {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_API}${url}`,
      method: options.method ?? 'GET',
      data: options.data,
      header: headers,
      success: (res: any) => resolve({ statusCode: res.statusCode, data: res.data }),
      fail: (err: any) => reject(err),
    })
  })
}

/**
 * 判断是否为认证失败（401 或 403 PolicyError）
 */
function isAuthFailure(statusCode: number, data: any): boolean {
  if (statusCode === 401) return true
  if (statusCode === 403 && data?.error?.name === 'PolicyError') return true
  return false
}

export async function request(url: string, options: any = {}) {
  let token = getToken()

  // 非公开路由必须有 token
  if (!token && !isPublicRoute(url)) {
    handleUnauthorized()
    throw new Error('未登录')
  }

  // Token 即将过期时自动刷新（非公开路由且非刷新接口本身）
  if (token && !isPublicRoute(url) && isTokenExpiring() && !url.includes('/auth/refresh')) {
    const newToken = await refreshToken()
    if (newToken) {
      token = newToken
    }
    // 刷新失败不阻断请求，让旧 token 继续尝试，后续 401/403 时再走 handleUnauthorized
  }

  try {
    const res = await doRequest(url, options, token)

    // 认证失败 → 尝试刷新 → 重试或跳登录
    if (
      isAuthFailure(res.statusCode, res.data) &&
      !isPublicRoute(url) &&
      !url.includes('/auth/refresh')
    ) {
      const newToken = await refreshToken()
      if (newToken) {
        // 用新 token 重试一次
        const retryRes = await doRequest(url, options, newToken)
        if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
          return retryRes.data
        }
        // 重试仍失败
        if (isAuthFailure(retryRes.statusCode, retryRes.data)) {
          if (!isHandlingUnauthorized) {
            isHandlingUnauthorized = true
            handleUnauthorized()
            setTimeout(() => { isHandlingUnauthorized = false }, 2000)
          }
          throw new Error('登录已过期')
        }
        throw retryRes.data
      } else {
        // 刷新失败 → 跳登录
        if (!isHandlingUnauthorized) {
          isHandlingUnauthorized = true
          handleUnauthorized()
          setTimeout(() => { isHandlingUnauthorized = false }, 2000)
        }
        throw new Error('登录已过期')
      }
    }

    // 401 在公开路由或刷新接口上（正常不应发生）
    if (res.statusCode === 401) {
      throw new Error('登录已过期')
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data
    }

    throw res.data
  } catch (e) {
    console.error('API请求失败:', e)
    throw e
  }
}

// ==================== 媒体鉴权播放 ====================
// 视频/音频/课件统一通过签名流式接口播放，未登录或未授权无法仅凭 URL 直接播放。
// 签名约 30 分钟过期，播放器遇到 403/加载失败时需重新调用本函数换取新签名地址。
export async function buildStreamSrc(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return ''
  // 外部直链（非本站 /static、/uploads，如 OSS 公网链接）不走鉴权代理，原样返回
  if (/^https?:\/\//i.test(pathOrUrl) && !/\/static\//.test(pathOrUrl) && !/\/uploads\//.test(pathOrUrl)) {
    return pathOrUrl
  }
  const res = await request('/zhao-oss/v1/media/stream-token', {
    method: 'POST',
    data: { path: pathOrUrl },
  })
  const rel = res?.data?.url || res?.url || pathOrUrl
  if (/^https?:\/\//i.test(rel)) return rel
  return rel ? `${BASE_API}${rel}` : pathOrUrl
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

export async function getCourseList(params?: CourseListParams) {
  const queryParams = params ? buildCourseQuery(params) : {}
  const query = stringifyQuery(queryParams)
  return request(`/zhao-course/v1/courses${query ? '?' + query : ''}`)
}

export async function getCourseCategories() {
  return request('/zhao-course/v1/course-categories')
}

export interface Tag {
  documentId: string
  name: string
  color?: string
}

export async function getTags() {
  return request('/zhao-tag/v1/tags?pagination[pageSize]=100')
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
  params.append('populate[quizzes]', 'true')
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

// ==================== 课程报名 API ====================

/** 报名类型：free=免费 points=积分兑换 paid=付费凭证 code=开通码 */
export type EnrollType = 'free' | 'points' | 'paid' | 'code'

/** 报名状态：enrolled=已开通 pending_review=待审核 rejected=已驳回 revoked=已撤销 */
export type EnrollmentStatus = 'enrolled' | 'pending_review' | 'rejected' | 'revoked'

export interface Enrollment {
  documentId: string
  status: EnrollmentStatus
  enrollType: EnrollType
  pointsSpent?: number
  voucherUrl?: string
  voucherNote?: string
  accessCode?: string
  reviewNote?: string
  enrolledAt?: string
  createdAt?: string
  course?: any
}

/**
 * 查询当前用户对某课程的报名状态
 * 返回 null 表示尚未报名
 */
export async function getMyEnrollment(courseId: string): Promise<Enrollment | null> {
  const res = await request(`/zhao-course/v1/enrollments/me?course=${courseId}`)
  return res?.data ?? null
}

/**
 * 创建报名
 * - free/points/code → 立即开通（status=enrolled）
 * - paid → 待审核（status=pending_review），需传 voucherUrl
 */
export async function createEnrollment(data: {
  course: string
  enrollType: EnrollType
  voucherUrl?: string
  voucherNote?: string
  accessCode?: string
}): Promise<Enrollment> {
  const res = await request('/zhao-course/v1/enrollments', {
    method: 'POST',
    data,
  })
  return res?.data ?? res
}

/**
 * 查询我的报名列表
 * params 可选：{ status?: EnrollmentStatus }
 */
export async function getMyEnrollments(params: { status?: EnrollmentStatus } = {}): Promise<Enrollment[]> {
  const query = params.status ? `?status=${params.status}` : ''
  const res = await request(`/zhao-course/v1/enrollments${query}`)
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

// ==================== 错题集 API ====================

export interface WrongQuizItem {
  id?: number
  documentId: string
  wrongCount?: number
  status?: 'active' | 'archived'
  reviewLevel?: number
  consecutiveCorrect?: number
  dueAt?: string
  lastWrongAt?: string
  lastCorrectAt?: string
  knowledgePointName?: string
  quiz?: any
  course?: any
  lesson?: any
}

/**
 * 我的错题列表（默认 active；archived 为已掌握历史）
 */
export async function getWrongQuizList(params: { status?: 'active' | 'archived'; page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams({
    status: params.status || 'active',
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 50),
  } as any).toString()
  const res = await request(`/zhao-quiz/v1/my/wrong-quizzes?${query}`)
  return res as any // { data: WrongQuizItem[], meta: { pagination: { total } } }
}

/**
 * 待复习错题（错题重练队列）
 */
export async function getWrongQuizDue(limit = 30) {
  const res = await request(`/zhao-quiz/v1/my/wrong-quizzes/due?limit=${limit}`)
  return res as any
}

/**
 * 拉取练习题（公开接口，按课程/课时过滤，返回含答案用于即时反馈）
 */
export async function getQuizQuestionList(params: { courseDocumentId?: string; lessonDocumentId?: string; knowledgePointDocumentId?: string; pageSize?: number } = {}) {
  const filters: string[] = ['filters[isPublished][$eq]=true']
  if (params.courseDocumentId) filters.push(`filters[course][documentId][$eq]=${params.courseDocumentId}`)
  if (params.lessonDocumentId) filters.push(`filters[lesson][documentId][$eq]=${params.lessonDocumentId}`)
  if (params.knowledgePointDocumentId) filters.push(`filters[tags][documentId][$eq]=${params.knowledgePointDocumentId}`)
  const query = [...filters, `pagination[pageSize]=${params.pageSize || 100}`].join('&')
  const res = await request(`/zhao-quiz/v1/quizzes?${query}`)
  return res as any // { data: quiz[], meta }
}

// ==================== 考试 / 组卷 API ====================

export interface QuizExam {
  documentId: string
  title: string
  description?: string
  timeLimit?: number   // 分钟，0 表示不限时
  passScore?: number
  totalPoints?: number
  questionCount?: number
  paperType?: 'fixed' | 'rule'
}

/**
 * 考试列表（公开，游客可见）
 */
export async function getQuizExamList(params: { page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams({
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 50),
  } as any).toString()
  const res = await request(`/zhao-quiz/v1/quiz-exams?${query}`)
  return res as any // { data: QuizExam[], meta }
}

/**
 * 获取试卷（规则组卷动态抽题，答案已隐藏）
 * @returns { documentId, questions: any[], shortages: string[] }
 */
export async function getQuizPaper(examDocumentId: string) {
  const res = await request(`/zhao-quiz/v1/my/quiz-exams/${examDocumentId}/paper`)
  return (res as any)?.data ?? res
}

export async function startQuizExam(data: { examDocumentId: string }) {
  const res = await request('/zhao-quiz/v1/my/quiz-exam-attempts/start', { method: 'POST', data })
  return (res as any)?.data ?? res
}

export async function submitQuizExam(attemptDocumentId: string, data: { answers: Array<{ quizDocumentId: string; answer: any }> }) {
  const res = await request(`/zhao-quiz/v1/my/quiz-exam-attempts/${attemptDocumentId}/submit`, { method: 'POST', data })
  return (res as any)?.data ?? res
}

/**
 * 练习/错题重练提交单题答案（自动判题 + 错题回流）
 * @returns record = { isCorrect?: boolean, scoringStatus, score }
 */
export async function submitQuizPracticeAnswer(data: {
  quizDocumentId: string
  answer: any
  lessonDocumentId?: string
  mode?: 'practice' | 'exam'
  practiceType?: 'knowledge' | 'random' | 'simulate' | 'wrong' | 'free'
}) {
  const res = await request('/zhao-quiz/v1/my/quiz-records/submit', { method: 'POST', data })
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

/** 获取当前用户角色名列表（如 ['admin','instructor']），未登录返回 [] */
export async function getMyRoles(): Promise<string[]> {
  try {
    const res = await request('/zhao-auth/v1/my/roles')
    const roles = res?.roles || []
    return Array.isArray(roles) ? roles.map((r: any) => r?.name).filter(Boolean) : []
  } catch (e) {
    console.warn('获取角色失败（按无特权处理）', e)
    return []
  }
}

/** 获取站点公开配置（含倍速特权角色名单 speedPrivilegedRoles） */
export async function getSitePublicConfig(): Promise<any> {
  try {
    const res = await request(`/zhao-common/v1/public/config?domain=${encodeURIComponent(SITE_DOMAIN)}`)
    return res?.data ?? res
  } catch (e) {
    console.warn('获取站点公开配置失败', e)
    return null
  }
}

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
  courseType?: 'free' | 'points' | 'paid'
  pointsPrice?: number
  enrollMode?: 'none' | 'required' | 'period'
  originalPrice?: number
  discountPrice?: number
  isFeatured?: boolean
  isTop?: boolean
  isRecommended?: boolean
  featureFlags?: Record<string, any> | null
  publishDate?: string
  enablePoints?: boolean
  points?: number
  difficulty?: string
  level?: string
  duration?: string
  author?: string
  studentCount?: number
  viewCount?: number
  rating?: number
  // 顺序锁定字段
  sequenceNumber?: number
  sequenceTag?: { documentId: string; name: string } | null
  enforceSequence?: boolean
  // 答题控制字段
  allowRetakeQuiz?: boolean
  quizRetryCount?: 'no_retry' | 'retry_1' | 'retry_2' | 'retry_3' | 'retry_4'
  // 关联测验（课程详情 populate）
  quizzes?: Array<{ documentId: string; title?: string }>
  exams?: Array<{ documentId: string; title?: string }>
}

export interface Lesson {
  documentId: string
  title: string
  duration: number
  completed?: boolean
  progress?: number
  // 顺序锁定字段
  sequenceNumber?: number
  sequenceTag?: { documentId: string; name: string } | null
  enforceSequence?: boolean
  isRequired?: boolean
  isCompleted?: boolean
  isPointsClaimed?: boolean
  // 关联测验（用于答题按钮/自动连播判定）
  quizzes?: Array<{ documentId: string; title?: string }>
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

// ==================== 线下活动相关 API ====================

/**
 * 活动列表（公开，游客可见）
 * @returns res.data 为活动文档数组
 */
export async function listActivities(params?: { status?: string; page?: number; pageSize?: number }) {
  const query = new URLSearchParams(params as any).toString()
  return request(`/zhao-point/v1/activities${query ? '?' + query : ''}`)
}

/**
 * 活动详情（公开）
 * @returns res.data 为活动对象
 */
export async function getActivityDetail(documentId: string) {
  const res = await request(`/zhao-point/v1/activities/${documentId}`)
  return res?.data ?? res
}

/**
 * 报名活动（需登录）
 * @returns { ok: true } 或 { ok: false, reason: 'already_signed_up' }
 */
export async function signupActivity(activityId: string) {
  const res = await request('/zhao-point/v1/my/activity/signup', {
    method: 'POST',
    data: { activityId },
  })
  return res?.data ?? res
}

/**
 * 取消报名（需登录）
 * @returns { ok: true }
 */
export async function cancelActivity(documentId: string) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/cancel`, {
    method: 'POST',
    data: {},
  })
  return res?.data ?? res
}

/**
 * 到场签到（需登录）
 * @returns { ok: true, attendanceId, point } 或 { ok: false, reason: 'already_checked_in' }
 */
export async function checkinActivity(documentId: string, data: { method: string; lat?: number; lng?: number }) {
  const res = await request(`/zhao-point/v1/my/activity/${documentId}/checkin`, {
    method: 'POST',
    data,
  })
  return res?.data ?? res
}

/**
 * 我的报名记录（需登录）
 * @returns res.data 为报名记录数组，每条含 activity 对象、attendance 字段
 */
export async function myActivities() {
  const res = await request('/zhao-point/v1/my/activities')
  return res?.data ?? res
}
