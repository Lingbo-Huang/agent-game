export type SafetyRoute = 'story' | 'urgent-support' | 'child-privacy'

export interface SafetyDecision {
  route: SafetyRoute
  title?: string
  message?: string
}

const urgentPatterns = [
  /不想活|想死|自杀|结束生命|伤害自己|割腕/,
  /杀了(他|她|他们)|伤害(他|她|别人)|马上报复/,
  /正在被(打|威胁|跟踪)|现在.*危险|有人要伤害我/,
]

const childPrivacyPatterns = [
  /我(叫|的名字是).{1,12}(今年|[0-9一二三四五六七八九十]+岁)/,
  /我家住在|我的学校是|我的手机号|爸爸妈妈不在/,
]

export function decideSafetyRoute(text: string, route: 'mirror' | 'children' | 'classic'): SafetyDecision {
  const normalized = text.replace(/\s+/g, '')
  if (urgentPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      route: 'urgent-support',
      title: '先离开故事，照顾眼前的安全',
      message: '如果你或他人正处在立即危险中，请立刻联系当地紧急服务，并尽快告诉一个你信任、能到场的人。这里不能代替专业或紧急帮助。',
    }
  }
  if (route === 'children' && childPrivacyPatterns.some((pattern) => pattern.test(normalized))) {
    return {
      route: 'child-privacy',
      title: '这些真实信息不用告诉故事',
      message: '请删掉姓名、年龄、学校、住址和电话，只保留“发生了什么”和“有什么感觉”。如果需要帮助，请让家长或其他可信任的大人一起看。',
    }
  }
  return { route: 'story' }
}
