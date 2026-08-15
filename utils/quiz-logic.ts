/** 判定答案是否正确：answer 可能是数组或单值，统一 String 比较 */
export function isCorrectAnswer(answer: any, key: string): boolean {
  const isArray = Array.isArray(answer)
  return isArray ? (answer as any[]).includes(key) : String(answer) === String(key)
}

/** 选项切换：单选/判断替换为 [key]，多选切换增删 */
export function toggleSelection(
  currentSelected: string[],
  key: string,
  questionType: string
): string[] {
  if (questionType === 'single_choice' || questionType === 'true_false') {
    return [key]
  }
  const index = currentSelected.indexOf(key)
  if (index > -1) {
    const next = [...currentSelected]
    next.splice(index, 1)
    return next
  }
  return [...currentSelected, key]
}

/** 得分计算：答对 && 积分开启 && 非练习模式才得分 */
export function computeEarnedPoints(
  isCorrect: boolean,
  pointsConfig: { enabled?: boolean; pointsType?: string; perQuestionPoints?: number },
  isPracticeMode: boolean,
  question: { points?: number },
  perQuestionPoints: number
): number {
  if (!isCorrect) return 0
  if (!pointsConfig.enabled || isPracticeMode) return 0
  if (pointsConfig.pointsType === 'quiz_points') {
    return question?.points || 0
  }
  return perQuestionPoints
}

/** 错题重试判定 */
export function canRetryAnswer(
  quizRetryEnabled: boolean,
  currentRetryCount: number,
  quizMaxRetryCount: number
): boolean {
  return quizRetryEnabled && currentRetryCount <= quizMaxRetryCount
}

/** 练习模式判定：已领分 → 练习模式 */
export function isQuizPracticeMode(earnedLessonIds: Set<string>, lessonDocumentId: string): boolean {
  return earnedLessonIds.has(lessonDocumentId)
}

/** 是否可进行正式答题：练习模式不限，正式答题受每日上限约束 */
export function canTakeFormalQuiz(
  isPracticeMode: boolean,
  todayQuizCount: number,
  maxDailyQuiz: number
): boolean {
  if (isPracticeMode) return true
  return todayQuizCount < maxDailyQuiz
}

/** 汇总本场得分 */
export function sumEarnedPoints(earnedPointsPerQuestion: number[]): number {
  return earnedPointsPerQuestion.reduce((sum, p) => sum + p, 0)
}