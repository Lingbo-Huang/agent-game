import { useState } from 'react'
import { MIMO_APPLICATION_URL } from './useMimoVoice'

export function MimoVoiceSettings({ configured, serverConfigured, hasSessionKey, error, onSave, onClear, onClose }: { configured: boolean; serverConfigured: boolean; hasSessionKey: boolean; error?: string; onSave: (key: string) => void; onClear: () => void; onClose: () => void }) {
  const [key, setKey] = useState('')
  const [formError, setFormError] = useState('')
  return <div className="rv-voice-settings" role="dialog" aria-modal="true" aria-label="电影级角色配音设置">
    <button type="button" onClick={onClose} aria-label="关闭配音设置">×</button>
    <small>XIAOMI MIMO · 角色级情绪配音</small>
    <h2>让角色真的开口，而不是机器朗读。</h2>
    <p>旁白、伙伴、见证者和裁决者分别绑定独立声线；每句话附带角色、场景和演绎方向，控制情绪、语速与停顿。</p>
    <ol><li>当前状态：<b>{hasSessionKey ? '现场直连已就绪' : serverConfigured ? '服务端代理已配置' : '尚未配置 MiMo'}</b></li><li>“已配置”只表示有可用凭据；每次播放仍会真实检查额度、限流和浏览器播放权限。</li><li>同时支持普通按量 Key（sk-）与 Token Plan Key（tp-），并自动选择对应接口。</li></ol>
    {(error || formError) && <em role="alert">{formError || `最近一次配音失败：${error}`}</em>}
    <a href={MIMO_APPLICATION_URL} target="_blank" rel="noreferrer">打开小米 MiMo API Keys →</a>
    <label><span>现场临时 MiMo API Key</span><input type="password" autoComplete="off" placeholder="sk-… / tp-…" value={key} onChange={(event) => setKey(event.target.value)} /></label>
    <div>{hasSessionKey && <button type="button" onClick={() => { onClear(); onClose() }}>清除本标签页 Key</button>}<button type="button" className="rv-primary" onClick={() => { if (key.trim()) { try { onSave(key); onClose() } catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Key 无效') } } else onClose() }}>{configured ? '完成' : '保存并启用'}</button></div>
    <small>优先尝试服务端代理，失败后自动走浏览器直连；两条路径都失败时保持静音，不用机器人音冒充。</small>
  </div>
}
