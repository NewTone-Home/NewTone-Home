import { useState } from 'react'

const MOTION_CARDS = [
  {
    key: 'fade',
    name: '淡入',
    note: '普通信息与环境出现。减弱:极短透明度变化。',
  },
  {
    key: 'write',
    name: '擦写',
    note: '记录、揭示、手稿性质内容。减弱:直接显示完成结果。',
  },
  {
    key: 'glitch',
    name: '故障重组',
    note: '减弱:一次轻微闪变,不抖动、不重复。',
    restriction: '只用于异常、里世界、数据矛盾、编码或语言重构。普通按钮、主题切换、普通菜单禁止使用。',
  },
  {
    key: 'drawout',
    name: '横向抽出',
    note: '工具或空间结构展开。减弱:原位出现。',
  },
]

function MotionStage({ kind }) {
  if (kind === 'fade') {
    return <p className="lab-anim lab-anim--fade">一段淡入出现的正文。</p>
  }
  if (kind === 'write') {
    return (
      <p className="lab-anim lab-anim--write">
        <span className="lab-write-text">见字如面,展信舒颜。</span>
      </p>
    )
  }
  if (kind === 'glitch') {
    return (
      <p className="lab-anim lab-anim--glitch" data-text="信号在此处中断——">
        信号在此处中断——
      </p>
    )
  }
  return (
    <div className="lab-anim lab-anim--drawout">
      <span className="lab-drawout-panel">从锚点方向抽出的工具条</span>
    </div>
  )
}

function MotionCard({ card, replayToken }) {
  const [localToken, setLocalToken] = useState(0)
  return (
    <div className="lab-motion-item">
      <div className="lab-motion-head">
        <span className="lab-motion-name">{card.name}</span>
        <button type="button" className="lab-chip" onClick={() => setLocalToken(token => token + 1)}>重播</button>
      </div>
      <div className="lab-motion-stage" key={`${replayToken}-${localToken}`}>
        <MotionStage kind={card.key} />
      </div>
      <p className="lab-support-text">{card.note}</p>
      {card.restriction && <p className="lab-motion-restriction">{card.restriction}</p>}
    </div>
  )
}

function MotionSamples({ replayToken }) {
  return (
    <section className="lab-motion" aria-label="四类动效">
      <p className="lab-scene-emphasis lab-field-mark">四类动效</p>
      <p className="lab-support-text">
        动态减弱不是全部取消:过程可以省略,结果必须保留。正式场景不要求同时使用全部四种。
      </p>
      <div className="lab-motion-grid">
        {MOTION_CARDS.map(card => (
          <MotionCard key={card.key} card={card} replayToken={replayToken} />
        ))}
      </div>
    </section>
  )
}

export default MotionSamples
