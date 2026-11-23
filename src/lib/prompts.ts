/** 第二行英文提问候选（按需求文档第五节） */
export const DEFAULT_PROMPTS = [
  'What deserves your attention right now?',
  'What will you give this moment to?',
  'Where shall your attention rest today?',
  'What is worth your focus in this moment?',
  'Before anything else — what matters now?',
]

/** 第一行恒定文案。拆行是为了封面主视觉的换行节奏，文案本身只在这里维护一次 */
export const HEADLINE_LINES = ['Attention', 'is all', 'you need'] as const
export const HEADLINE = HEADLINE_LINES.join(' ')

/**
 * 按日期确定性地选择今天的文案（同一天始终同一句，跨天自动轮换）。
 * 用日期键的字符和做种子，保证稳定且每天不同。
 */
export function promptForDate(dateKey: string, custom: string[] = []): string {
  // 防御：导入或旧版本数据里 custom 可能是 null/非数组，避免 .filter 报错导致整页崩溃
  const safeCustom = Array.isArray(custom) ? custom : []
  const pool = [...DEFAULT_PROMPTS, ...safeCustom.filter((s) => typeof s === 'string' && s.trim())]
  if (pool.length === 0) return DEFAULT_PROMPTS[0]
  let seed = 0
  for (let i = 0; i < dateKey.length; i++) seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0
  return pool[seed % pool.length]
}
