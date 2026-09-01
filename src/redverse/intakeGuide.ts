export type IntakeLens = 'facts' | 'unknown' | 'stakes'

export interface IntakeQuestion {
  lens: IntakeLens
  label: string
  question: string
  placeholder: string
}

const QUESTIONS: Record<IntakeLens, IntakeQuestion> = {
  facts: {
    lens: 'facts', label: '补一块事实', question: '如果先不猜对方的动机，你能确认发生了什么？',
    placeholder: '例如：他在汇报里用了哪些表述？谁在场？',
  },
  unknown: {
    lens: 'unknown', label: '留一块未知', question: '现在最想弄清、但还没有证据确定的是什么？',
    placeholder: '例如：这是一次疏忽，还是他有意这样做？',
  },
  stakes: {
    lens: 'stakes', label: '说清在意', question: '这一局结束时，你最想看清哪一种选择的代价？',
    placeholder: '例如：直接说、先留证据，或暂时不行动。',
  },
}

export function buildIntakeQuestions(story: string): IntakeQuestion[] {
  const normalized = story.trim()
  const result: IntakeQuestion[] = []
  if (!/(发生|说|做|当时|昨天|今天|在场|汇报|拒绝|选择)/.test(normalized)) result.push(QUESTIONS.facts)
  if (!/(不知道|不确定|不理解|想不通|为什么|是否|是不是)/.test(normalized)) result.push(QUESTIONS.unknown)
  if (!/(希望|想要|担心|害怕|不能接受|最在意|纠结|代价)/.test(normalized)) result.push(QUESTIONS.stakes)
  return [...result, ...Object.values(QUESTIONS).filter((item) => !result.includes(item))].slice(0, 3)
}

export function composeGuidedStory(story: string, answers: Partial<Record<IntakeLens, string>>): string {
  const details = (Object.entries(answers) as Array<[IntakeLens, string]>)
    .filter(([, answer]) => answer?.trim())
    .map(([lens, answer]) => `${QUESTIONS[lens].label}：${answer.trim()}`)
  return details.length ? `${story.trim()}\n\n引导补充：\n${details.join('\n')}` : story.trim()
}
