export interface DetectiveChoice {
  id: string
  title: string
  consequence: string
  method: 'observation' | 'testimony' | 'verification'
}

export interface DetectiveBeat {
  location: string
  title: string
  prompt: string
  evidence: string
  cannotProve: string
  choices: DetectiveChoice[]
}

/** 原创案件，不使用任何既有侦探 IP、角色或案件。 */
export const detectiveBeats: DetectiveBeat[] = [
  {
    location: '雾港钟楼', title: '停在九点十二分的钟', prompt: '馆长失踪前，钟楼为何提前停摆？',
    evidence: '齿轮里卡着一小片蓝色蜡封。', cannotProve: '蜡片只能证明有人接触过齿轮，不能证明那个人让馆长失踪。',
    choices: [
      { id: 'bag-wax', title: '封存蜡片并记录位置', consequence: '物证保留了原始位置，可以与其他封缄互证。', method: 'observation' },
      { id: 'ask-crowd', title: '先问围观者谁最可疑', consequence: '你收集到许多判断，却没有一条能独立核验。', method: 'testimony' },
      { id: 'restart-clock', title: '尝试重新启动钟表', consequence: '你确认机械仍能运转，也改变了部分现场。', method: 'verification' },
    ],
  },
  {
    location: '潮汐档案馆', title: '少了一页的借阅簿', prompt: '借阅簿第 47 页被整齐割走。先查什么？',
    evidence: '前后页的压痕留下“北堤 3 号仓”字样。', cannotProve: '压痕说明被撕页曾写过地点，不能证明写字者去过那里。',
    choices: [
      { id: 'trace-indent', title: '侧光拓印压痕', consequence: '隐藏地点变成可复查的文字记录。', method: 'observation' },
      { id: 'accuse-clerk', title: '追问管理员为何撕页', consequence: '管理员变得防御；你仍未证明页是他撕的。', method: 'testimony' },
      { id: 'check-copies', title: '找当日登记副本', consequence: '你获得一个独立来源，用来检验压痕内容。', method: 'verification' },
    ],
  },
  {
    location: '旧渡口', title: '船夫互相冲突的时间', prompt: '两名船夫分别说八点四十和九点整见过馆长。',
    evidence: '两人口供都受潮汐钟声影响，其中一人把第二遍报时当成第一遍。', cannotProve: '口供矛盾不能自动说明有人撒谎，也可能来自参照物错误。',
    choices: [
      { id: 'separate-witnesses', title: '分开复述所见细节', consequence: '你得到衣着、方向与灯色三个可比较的细节。', method: 'testimony' },
      { id: 'force-time', title: '逼他们给出唯一时间', consequence: '答案变得整齐，真实的不确定却被藏起来。', method: 'testimony' },
      { id: 'check-tide-bell', title: '核对潮汐钟记录', consequence: '口供时间被转换成可验证的外部参照。', method: 'verification' },
    ],
  },
  {
    location: '北堤仓库', title: '从里面反锁的门', prompt: '仓门看似从内反锁，窗边却有新鲜盐粒。',
    evidence: '细线可从排水孔牵动门闩，盐粒来自线被拉过的痕迹。', cannotProve: '机关证明密室可以伪造，不等于已经锁定操作者。',
    choices: [
      { id: 'rebuild-lock', title: '在不破坏现场下复现', consequence: '“不可能”变成一项可重复验证的动作。', method: 'verification' },
      { id: 'break-door', title: '立即破门寻找馆长', consequence: '你优先救人，但门闩与线痕会被破坏。', method: 'observation' },
      { id: 'watch-exits', title: '先封锁所有出口', consequence: '你控制人员流动，却仍需解释门闩如何移动。', method: 'observation' },
    ],
  },
  {
    location: '修船铺', title: '同一种蓝蜡', prompt: '修船铺也使用蓝蜡封存防水图纸。',
    evidence: '钟楼蜡片含松脂，修船铺的蜡不含，肉眼相似但配方不同。', cannotProve: '颜色相同不是同源证据；排除修船铺也不等于证明另一人有罪。',
    choices: [
      { id: 'compare-formula', title: '比较蜡的配方', consequence: '一个看似强烈的指向被可靠证伪。', method: 'verification' },
      { id: 'follow-color', title: '按颜色搜查修船匠', consequence: '搜索范围看似明确，却建立在低区分度特征上。', method: 'observation' },
      { id: 'ask-source', title: '询问蜡料采购来源', consequence: '你找到供应链记录，可与档案馆封缄对照。', method: 'testimony' },
    ],
  },
  {
    location: '灯塔值班室', title: '没有点亮的第三盏灯', prompt: '馆长留下“第三盏灯熄灭时看北面”的字条。',
    evidence: '第三盏并非灯，而是海图上第三枚荧光标记，指向废弃信号站。', cannotProve: '字条给出目的地，不解释馆长是自愿前往还是被胁迫。',
    choices: [
      { id: 'read-map-context', title: '结合馆长常用海图解码', consequence: '字条与馆长习惯形成交叉验证。', method: 'verification' },
      { id: 'watch-lanterns', title: '等实体灯塔第三盏熄灭', consequence: '你按字面等待，时间继续流失。', method: 'observation' },
      { id: 'broadcast-clue', title: '公开字条征集解释', consequence: '可能得到新视角，也让相关人知道调查方向。', method: 'testimony' },
    ],
  },
  {
    location: '废弃信号站', title: '馆长留下的录音', prompt: '录音中，馆长说自己来取回被调包的航路原图。',
    evidence: '背景汽笛与潮汐记录吻合，录音时间晚于两名船夫的目击。', cannotProve: '录音能校正时间线，仍不能单独证明谁调包了原图。',
    choices: [
      { id: 'verify-audio-time', title: '用汽笛与潮汐校时', consequence: '三份独立记录把时间线稳定下来。', method: 'verification' },
      { id: 'trust-voice', title: '听出馆长声音就全盘相信', consequence: '身份较可信，叙述中的推断仍未被外部证据证实。', method: 'testimony' },
      { id: 'search-station', title: '先搜索信号站', consequence: '你发现原图包装，却暂时没有核验录音时间。', method: 'observation' },
    ],
  },
  {
    location: '港务复核厅', title: '提交一条有限的结论', prompt: '你要向港务官提交哪种结论？',
    evidence: '蜡封、压痕、潮汐、门闩机关和录音已形成相互独立的证据链。', cannotProve: '证据链能定位调包路线和在场时间，不能替任何人猜完整动机。',
    choices: [
      { id: 'bounded-conclusion', title: '只提交证据能支持的结论', consequence: '复核程序启动，馆长在信号站获救；动机留待进一步调查。', method: 'verification' },
      { id: 'name-villain', title: '给故事补上一个完整坏人', consequence: '结论更痛快，却把未证实的动机混进了事实。', method: 'testimony' },
      { id: 'wait-perfect', title: '等所有未知都消失再提交', consequence: '你避免犯错，也延误了证据足够支持的救援行动。', method: 'observation' },
    ],
  },
]
