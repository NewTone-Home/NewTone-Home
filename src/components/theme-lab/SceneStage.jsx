import { useState } from 'react'

const MOTES = Array.from({ length: 8 }, (_, index) => ({
  left: `${(index * 13.7 + 6) % 92}%`,
  top: `${(index * 23 + 12) % 78}%`,
  delay: `${(index % 4) * -2.4}s`,
  duration: `${11 + (index % 3) * 4}s`,
}))

function SceneStage({ replayToken }) {
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <section className="lab-scene" aria-label="主场景">
      <div className="lab-scene-ambient" aria-hidden="true">
        {MOTES.map((mote, index) => (
          <span
            key={index}
            className="lab-mote"
            style={{ left: mote.left, top: mote.top, animationDelay: mote.delay, animationDuration: mote.duration }}
          />
        ))}
      </div>

      <p className="lab-scene-emphasis" key={`emphasis-${replayToken}`}>表世界 · 四月 · 祖宅院</p>

      <div className="lab-scene-body">
        <p className="lab-body-text">
          阳光穿过<span className="lab-word-anchor">
            <button
              type="button"
              className={`lab-word-interactive${noteOpen ? ' is-active' : ''}`}
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen(open => !open)}
            >老槐树</button>
            {noteOpen && (
              <span className="lab-float-note" role="note">
                <span className="lab-float-note-body">
                  树龄约一百二十年。姬家搬进来那年,它已经在了。
                </span>
                <span className="lab-float-note-erased">这里曾写过另一个名字</span>
              </span>
            )}
          </span>洒下一地碎影。风很轻,带着春天的花草味道。
          他把手机揣回口袋,决定先不回这条消息——院子里安静得能听见槐叶互相碰了一下。
        </p>
        <p className="lab-body-text">
          消息只有一句话,却让整个上午都变得不太一样。他在门槛上坐了一会儿,
          数了数石阶上的青苔,又抬头看了看天。
        </p>
        <p className="lab-support-text">上午十点 · 天气晴 · 记录同步中</p>
      </div>

      <div className="lab-scene-tools" role="group" aria-label="场景内工具">
        <button type="button" className="lab-tool-item">留痕</button>
        <button type="button" className="lab-tool-item is-current" aria-pressed="true">视角</button>
        <button type="button" className="lab-tool-item" disabled>回溯</button>
      </div>

      <p className="lab-scene-hint">
        这里是世界/主内容层:正文直接生活在场景里,不放在纸卡上。
        点击「老槐树」会展开一张浮层纸片;「视角」处于当前交互状态;「回溯」暂不可用但仍可辨认。
      </p>
    </section>
  )
}

export default SceneStage
