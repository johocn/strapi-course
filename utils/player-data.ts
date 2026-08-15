/** 把 API 返回的各种数据形态统一为数组（数组 / {data:[...]} / 单对象） */
export function normalizeList<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.data)) return data.data
  if (data && typeof data === 'object' && !Array.isArray(data.data)) return [data.data]
  return []
}

/** 以 lesson.documentId 构建进度对照 Map，防 number/string 类型不一致 */
export function buildProgressMap(progressData: any[]): Map<string, any> {
  const map = new Map<string, any>()
  for (const p of progressData) {
    const lessonDocId = p?.lesson?.documentId
    if (lessonDocId) map.set(lessonDocId, p)
  }
  return map
}

/** 富化课时，追加进度相关字段 */
export function enrichLessons<T extends { documentId: string }>(lessonData: T[], progressMap: Map<string, any>): (T & {
  completed: boolean
  progressPercent: number
  progressId?: number
  playPosition: number
  progressDuration: number
})[] {
  return lessonData.map((l) => {
    const p = progressMap.get(l.documentId)
    return {
      ...l,
      completed: p?.isCompleted || false,
      progressPercent: p?.progress || 0,
      progressId: p?.id || undefined,
      playPosition: p?.playPosition || 0,
      progressDuration: p?.duration || 0,
    }
  })
}

/** 第一个未完成课时下标，无则 -1 */
export function findFirstIncompleteIndex(lessons: Array<{ completed?: boolean }>): number {
  return lessons.findIndex((l) => !l.completed)
}

/** 从积分流水抽取已领课时 id（source 可能是 number/string，统一 String） */
export function extractEarnedLessonIds(records: any[]): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.source) set.add(String(r.source))
  }
  return set
}

/** 统计 createdAt 前缀等于 todayStr 的流水条数 */
export function countTodayQuizRecords(records: any[], todayStr: string): number {
  let count = 0
  for (const r of records) {
    if (r.createdAt && r.createdAt.slice(0, 10) === todayStr) count++
  }
  return count
}