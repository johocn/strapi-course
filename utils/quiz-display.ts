/**
 * 题目展示与答案构建工具（练习/考试/错题共用）
 * 兼容后端 quiz 文档的多种 options 存储格式：string | string[] | [{key,text}] | JSON 字符串
 */

export interface QuizOpt {
  key: string
  text: string
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** 归一化选项为 [{ key, text }] */
export function normalizeOptions(raw: any): QuizOpt[] {
  if (raw == null) return []
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (t.startsWith('[')) {
      try {
        return arrayToOpts(JSON.parse(t))
      } catch {
        /* ignore */
      }
    }
    if (t.includes('|')) return arrayToOpts(t.split('|'))
    return []
  }
  if (Array.isArray(raw)) return arrayToOpts(raw)
  return []
}

function arrayToOpts(arr: any[]): QuizOpt[] {
  return arr.map((o, i) => {
    if (o != null && typeof o === 'object') {
      const key = o.key != null ? String(o.key) : (LETTERS[i] ?? String(i + 1))
      const text = o.text ?? o.label ?? o.value ?? JSON.stringify(o)
      return { key, text: String(text) }
    }
    return { key: LETTERS[i] ?? String(i + 1), text: String(o).trim() }
  })
}

/** 题型中文名 */
export function typeText(type?: string): string {
  const map: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    true_false: '判断题',
    fill_blank: '填空题',
    short_answer: '简答题',
    essay: '问答题',
    matching: '匹配题',
    ordering: '排序题',
  }
  return map[type as string] ?? '题目'
}

/** 选项字母标签 */
export function optionLabel(index: number): string {
  return LETTERS[index] ?? String(index + 1)
}

/** richtext 转纯文本（列表摘要用） */
export function stripHtml(html: any): string {
  if (html == null) return ''
  let s = String(html)
  s = s.replace(/<[^>]+>/g, '')
  return s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 难度中文 */
export function difficultyText(d?: string): string {
  const map: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[d as string] ?? ''
}

/**
 * 根据题型与作答构建提交给 submitAnswer/submitExam 的 answer
 * - 单选：命中选项 key
 * - 多选：命中选项 key 排序后用逗号连接（后端按字符串精确比较）
 * - 判断：命中选项的文本（通常是“正确/错误”）
 * - 填空：直接文本
 * - 简答/问答：{ text }（后端转人工复核或关键词初判）
 */
export function buildAnswer(type: string, selectedKeys: string[], opts: QuizOpt[], freeText: string): any {
  if (type === 'short_answer' || type === 'essay') return { text: freeText }
  if (type === 'fill_blank') return freeText
  if (type === 'true_false') {
    const o = opts.find((x) => selectedKeys.includes(x.key))
    return o ? o.text : ''
  }
  if (type === 'multiple_choice') {
    return [...selectedKeys].sort().join(',')
  }
  return selectedKeys[0] || ''
}