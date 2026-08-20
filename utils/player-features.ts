// strapi-course/utils/player-features.ts
// 课程播放功能开关（featureFlags）容错解析、seekMode 默认值、倍速特权判定、倍速记忆

export type SeekMode = 'locked' | 'played_only' | 'free'

export interface CourseQuizFlags {
  /** 本课/课程刷题入口 */
  practice: boolean
  /** 课堂测验（原「去答题」） */
  lessonQuiz: boolean
  /** 模拟考试入口 */
  exam: boolean
  /** 自由答题入口 */
  freeAnswer: boolean
  /** 随机抽题入口 */
  random: boolean
  /** 仅这些角色可见考试/试卷（独立于 learnRoles） */
  examRoles: string[]
}

export interface CourseFeatureFlags {
  /** 课程是否配置了 featureFlags（null/非对象=未配置，用于默认值规则区分） */
  configured: boolean
  playbackSpeed: boolean
  allowLandscape: boolean
  screenLock: boolean
  autoNext: boolean
  pictureInPicture: boolean
  vipSpeedOverride: boolean
  seekMode: SeekMode
  /** 允许学习/可见该课程的角色码白名单（空=不启用角色门控） */
  learnRoles: string[]
  /** 课程级倍速特权角色名单（空课程级未配置=回退站点级 speedPrivilegedRoles） */
  vipRoles: string[]
  quiz: CourseQuizFlags
}

/** 判定用户是否命中角色白名单：admin 恒放行；白名单空=放行；否则交集 */
export function hasGrantedRole(userRoles: string[], whitelist: string[]): boolean {
  if (!Array.isArray(whitelist) || whitelist.length === 0) return true
  const roles = Array.isArray(userRoles) ? userRoles : []
  if (roles.includes('admin')) return true
  return roles.some((r) => whitelist.includes(r))
}

export const DEFAULT_SEEK_MODE: SeekMode = 'played_only'
export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

const SPEED_STORAGE_KEY = 'lastPlaybackSpeed'

/**
 * 解析课程 featureFlags（json 字段）
 * 默认值规则：
 * - featureFlags 为 null / 非对象 / 未知 key → 全部关闭，configured=false
 * - configured=true 但未写 seekMode → 默认 played_only
 * - configured=false → seekMode 视为 free（保持现状，向后兼容存量课程）
 */
export function parseCourseFeatureFlags(raw: unknown): CourseFeatureFlags {
  const isObject = !!raw && typeof raw === 'object' && !Array.isArray(raw)
  const ff = isObject ? (raw as Record<string, any>) : {}
  const configured = isObject
  const quizRaw = isObject && ff.quiz && typeof ff.quiz === 'object' && !Array.isArray(ff.quiz)
    ? (ff.quiz as Record<string, any>)
    : {}
  const rolesOf = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  return {
    configured,
    playbackSpeed: ff.playbackSpeed === true,
    allowLandscape: ff.allowLandscape === true,
    screenLock: ff.screenLock === true,
    autoNext: ff.autoNext === true,
    pictureInPicture: ff.pictureInPicture === true,
    vipSpeedOverride: ff.vipSpeedOverride === true,
    seekMode: configured
      ? (ff.seekMode === 'locked' || ff.seekMode === 'free' || ff.seekMode === 'played_only'
        ? (ff.seekMode as SeekMode)
        : DEFAULT_SEEK_MODE)
      : 'free',
    learnRoles: rolesOf(ff.learnRoles),
    vipRoles: rolesOf(ff.vipRoles),
    quiz: {
      practice: quizRaw.practice === true,
      lessonQuiz: quizRaw.lessonQuiz === true,
      exam: quizRaw.exam === true,
      freeAnswer: quizRaw.freeAnswer === true,
      random: quizRaw.random === true,
      examRoles: rolesOf(quizRaw.examRoles),
    },
  }
}

/** 是否允许显示倍速按钮：开关开启，或课程开启特权且用户命中特权角色名单 */
export function isSpeedEnabled(
  flags: CourseFeatureFlags,
  userRoles: string[],
  speedPrivilegedRoles: string[]
): boolean {
  if (flags.playbackSpeed) return true
  if (!flags.vipSpeedOverride) return false
  const roles = Array.isArray(userRoles) ? userRoles : []
  if (roles.length === 0) return false
  // 课程级 vipRoles 优先；未配置课程级时回退到站点级 speedPrivilegedRoles
  const privileged = Array.isArray(flags.vipRoles) && flags.vipRoles.length > 0
    ? flags.vipRoles
    : (Array.isArray(speedPrivilegedRoles) ? speedPrivilegedRoles : [])
  return roles.some((r) => privileged.includes(r))
}

/** 读取记忆的倍速（本地存储），非法值回退 1x */
export function getSavedSpeed(): number {
  try {
    const v = Number(uni.getStorageSync(SPEED_STORAGE_KEY))
    return SPEED_OPTIONS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

/** 保存倍速档位（倍速记忆） */
export function saveSpeed(rate: number): void {
  try {
    uni.setStorageSync(SPEED_STORAGE_KEY, rate)
  } catch {
    // ignore
  }
}