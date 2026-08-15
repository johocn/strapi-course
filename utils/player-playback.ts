export type PlaybackAction =
  | { type: 'show_resume'; position: number }
  | { type: 'show_completed' }
  | { type: 'resume'; position: number }
  | { type: 'restart' }
  | { type: 'start' }

interface PlaybackLesson {
  documentId: string
  completed?: boolean
  playPosition?: number
}

/** 续播/完成/从头三态决策。严格复刻 video-player.vue offerLessonPlayback 的 if/else 顺序 */
export function decidePlaybackAction(
  lesson: PlaybackLesson,
  alreadyPrompted: Set<string>
): PlaybackAction {
  if (alreadyPrompted.has(lesson.documentId)) {
    if (lesson.completed) return { type: 'restart' }
    if (lesson.playPosition && lesson.playPosition > 0)
      return { type: 'resume', position: lesson.playPosition }
    return { type: 'start' }
  }
  if (lesson.completed) return { type: 'show_completed' }
  if (lesson.playPosition && lesson.playPosition > 0)
    return { type: 'show_resume', position: lesson.playPosition }
  return { type: 'start' }
}

/** MM:SS 时间格式化 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/** 时长格式化：X小时Y分钟Z秒 */
export function formatDuration(val: any): string {
  const totalSeconds = Number(val) || 0
  if (totalSeconds <= 0) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (mins > 0) parts.push(`${mins}分钟`)
  if (secs > 0) parts.push(`${secs}秒`)
  return parts.join('') || '0秒'
}

/** 播放进度百分比；duration <= 0 返回 null（不可算，由调用方决定是否更新，保持原值语义） */
export function computeProgress(currentTime: number, duration: number): number | null {
  if (duration <= 0) return null
  return (currentTime / duration) * 100
}