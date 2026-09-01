import { describe, expect, it } from 'vitest'
import { buildSeedanceDirectorPrompt } from './seedance'

describe('Seedance director brief', () => {
  it('turns story beats into a timed cinematic and audio plan', () => {
    const prompt = buildSeedanceDirectorPrompt({
      worldTitle: '岔航群岛',
      conflictFocus: '不确定中的取舍',
      shots: [
        { title: '进入世界', meaning: '把困惑放到安全距离外观察' },
        { title: '核对线索', meaning: '区分事实与最坏想象' },
        { title: '角色拒绝', meaning: '看见不同立场保护的东西' },
        { title: '带回现实', meaning: '只做一个可逆的小行动' },
      ],
    })

    expect(prompt).toContain('00:00-00:03')
    expect(prompt).toContain('00:11-00:15')
    expect(prompt).toContain('摄像机缓慢向左横移')
    expect(prompt).toContain('声音：')
    expect(prompt).toContain('不要生成文字或字幕')
    expect(prompt).toContain('角色轮廓、脸型、发型、服装、关键物件与色彩前后一致')
    expect(prompt).toContain('不变形、不漂移、不凭空增减人物')
    expect(prompt).toContain('逐帧同步')
  })

  it('does not leak long or multiline source material into the provider prompt', () => {
    const secret = `真实姓名\n${'很长的私人内容'.repeat(80)}`
    const prompt = buildSeedanceDirectorPrompt({
      worldTitle: secret,
      conflictFocus: secret,
      shots: [{ title: secret, meaning: secret }],
    })

    expect(prompt).not.toContain('\n很长的私人内容很长的私人内容很长的私人内容很长的私人内容很长的私人内容')
    expect([...prompt].length).toBeLessThan(1800)
  })
})
