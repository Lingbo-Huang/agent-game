import type { CompiledWorld } from './worldCompiler'

export interface ExperienceReceipt {
  reportedFact: string
  feeling: string
  unknown: string
  experiment: string
}

const FEELINGS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /生气|不爽|愤怒|气愤|委屈/, label: '生气或委屈，也许因为某件重要的事没有被看见' },
  { pattern: /焦虑|担心|害怕|不安|怕/, label: '担心、不安，可能还夹着对后果的顾虑' },
  { pattern: /难过|伤心|失落|闷闷不乐/, label: '难过或失落，像是期待与现实之间出现了落差' },
  { pattern: /纠结|犹豫|难以抉择|不知道.*选/, label: '纠结和犹豫，因为不同选择都在保护某种重要的东西' },
  { pattern: /自责|失败|不够好|没自信/, label: '自我怀疑，也许一次结果正在被放大成对自己的总评价' },
]

const UNKNOWN_BY_THEME: Record<CompiledWorld['themeId'], string> = {
  workplace: '对方的真实动机、完整贡献记录，以及第三方会如何判断，目前都还没有被验证。',
  relationship: '对方真正想保护的需要、双方对旧约定的理解，以及新边界是否可行，目前都还未知。',
  decision: '每条路的真实代价、哪些担心会发生，以及哪一步不可逆，目前都不能靠想象确定。',
  growth: '这次结果究竟来自能力、方法、反馈还是环境，目前还不能给整个人下结论。',
}

function conciseSource(source: string): string {
  const normalized = source.replace(/\s+/g, ' ').trim()
  return normalized.length <= 88 ? normalized : `${normalized.slice(0, 86)}…`
}

export function buildExperienceReceipt(source: string, world: CompiledWorld): ExperienceReceipt {
  const matchedFeeling = FEELINGS.find(({ pattern }) => pattern.test(source))?.label
  return {
    reportedFact: `你报告的情境是：“${conciseSource(source)}”——这是本局的起点，不会被系统自动当成对他人动机的定论。`,
    feeling: matchedFeeling ?? '你被这件事卡住了；具体感受可以在探索中继续辨认，不必现在就给它一个标准答案。',
    unknown: UNKNOWN_BY_THEME[world.themeId],
    experiment: `${world.objectiveTitle}：${world.objectiveDetail}`,
  }
}
