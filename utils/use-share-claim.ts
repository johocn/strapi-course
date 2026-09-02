import { ref, onUnmounted } from 'vue'
import { getShareClaimStatus, claimActivityShare } from '../services/api'
import { isLoggedIn } from './storage'
import { redirectToLogin } from './auth'

export interface ShareClaimState {
  canClaim: boolean
  points: number
  remainingMs: number
  dailyCount: number
  dailyLimit: number
  intervalMinutes: number
  hasClick: boolean
  waitClick: boolean
}

export const DEFAULT_SHARE_STATE: ShareClaimState = {
  canClaim: false,
  points: 5,
  remainingMs: 0,
  dailyCount: 0,
  dailyLimit: 0,
  intervalMinutes: 30,
  hasClick: false,
  waitClick: false,
}

export interface ShareDim {
  dimType: string
  dimId: string | number | undefined
}

/**
 * 分享领分状态管理：任务中心 / 活动页 / 分享引导弹窗共用。
 * dim?: 返回当前分享维度（{ dimType:'activity', dimId } / { dimType:'task', dimId }）的回调。
 * 成功判定 = 好友点击；冷却从该维度首次点击起算；每日上限按维度核算。
 */
export function useShareClaim(dim?: () => ShareDim | undefined) {
  const state = ref<ShareClaimState>({ ...DEFAULT_SHARE_STATE })
  const loading = ref(false)
  const claiming = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (timer) { clearInterval(timer); timer = null }
  }

  async function refresh() {
    clearTimer()
    // 未登录不轮询受保护接口，按钮置灰（避免误触发跳登录）
    if (!isLoggedIn()) {
      state.value = { ...DEFAULT_SHARE_STATE, canClaim: false, waitClick: true }
      return
    }
    loading.value = true
    try {
      const dpt = dim?.()
      const d: any = await getShareClaimStatus(dpt)
      state.value = {
        canClaim: !!d?.canClaim,
        points: typeof d?.points === 'number' ? d.points : DEFAULT_SHARE_STATE.points,
        remainingMs: Number(d?.remainingMs) || 0,
        dailyCount: Number(d?.dailyCount) || 0,
        dailyLimit: Number(d?.dailyLimit) || 0,
        intervalMinutes: Number(d?.intervalMinutes) || DEFAULT_SHARE_STATE.intervalMinutes,
        hasClick: d?.hasClick !== undefined ? !!d.hasClick : (d?.waitClick !== undefined ? !d.waitClick : false),
        waitClick: !!d?.waitClick,
      }
      // 冷却中 → 每秒倒计时，到 0 自动重新查询点亮
      if (!state.value.canClaim && state.value.remainingMs > 0) {
        timer = setInterval(() => {
          state.value.remainingMs = Math.max(0, state.value.remainingMs - 1000)
          if (state.value.remainingMs <= 0) { clearTimer(); refresh() }
        }, 1000)
      } else if (state.value.waitClick) {
        // 等待好友点击：定期轮询刷新，好友点击后自动进入冷却倒计时
        timer = setInterval(() => { refresh() }, 30000)
      }
    } catch {
      // 查询失败回退可点按（后端做最终裁决），避免功能不可用
      state.value = { ...DEFAULT_SHARE_STATE, canClaim: isLoggedIn() }
    } finally {
      loading.value = false
    }
  }

  async function claim() {
    if (claiming.value) return { ok: false, message: '请稍候' }
    if (!isLoggedIn()) { redirectToLogin(); return { ok: false, message: '请先登录' } }
    claiming.value = true
    try {
      const dpt = dim?.()
      const rec: any = await claimActivityShare(dpt)
      const pts = typeof rec?.points === 'number' ? rec.points : state.value.points
      // 成功即刷新置灰进入冷却
      await refresh()
      return { ok: true, points: pts }
    } catch (e: any) {
      const msg = (e as any)?.error || (e as any)?.message || '领取失败'
      return { ok: false, message: msg }
    } finally {
      claiming.value = false
    }
  }

  onUnmounted(clearTimer)

  return { state, loading, claiming, refresh, claim }
}

/** 规则说明文案 */
export function shareRuleText(s: ShareClaimState) {
  const interval = s.intervalMinutes || 30
  const daily = s.dailyLimit || 0
  return `每次分享得 ${s.points} 积分${daily > 0 ? `，每日最多 ${daily} 次` : ''}，好友点击后过 ${interval} 分钟可领`
}

/** 置灰原因文案（可领取时返回空串） */
export function shareReasonText(s: ShareClaimState) {
  if (s.canClaim) return ''
  if (s.dailyLimit > 0 && s.dailyCount >= s.dailyLimit) return '今日分享积分次数已达上限'
  if (s.waitClick) return '分享出去等待好友点击'
  const min = Math.ceil(s.remainingMs / 60000)
  if (min > 0) return `距下次可领取约 ${min} 分钟`
  return '登录后可领取'
}