const SNOW_FLAKES = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 7.3 + 4) % 96}%`,
  delay: `${(index % 7) * -1.7}s`,
  duration: `${9 + (index % 5) * 1.8}s`,
  scale: 0.6 + (index % 3) * 0.3,
}))

function LayerStackSample() {
  return (
    <section className="lab-stack" aria-label="层级压力场景">
      <p className="lab-scene-emphasis lab-field-mark">里世界残响 · 层级压力测试</p>
      <p className="lab-support-text">
        环境效果不盖住正文;正文不盖住工具;工具不被交互状态遮挡;警告只在必要时位于最上层。
        动态减弱时,雪固定为静态残留,其余信息与操作全部保留。
      </p>
      <div className="lab-stack-demo">
        <div className="lab-stack-snow" aria-hidden="true">
          {SNOW_FLAKES.map((flake, index) => (
            <span
              key={index}
              className="lab-snowflake"
              style={{
                left: flake.left,
                animationDelay: flake.delay,
                animationDuration: flake.duration,
                '--flake-scale': flake.scale,
              }}
            />
          ))}
        </div>
        <div className="lab-stack-content">
          <p className="lab-body-text">
            雪一直在下,但只落在文字之外。这段正文始终稳定、可读,
            环境动画再热闹,也不会有一片雪穿过这行字。
          </p>
          <div className="lab-stack-float" role="group" aria-label="浮层工具">
            <button type="button" className="lab-tool-item">浮层工具项</button>
            <button type="button" className="lab-tool-item is-current" aria-pressed="true">当前交互项</button>
          </div>
        </div>
        <div className="lab-stack-warning" role="note">
          <span className="lab-warning-mark" aria-hidden="true">!</span>
          检测到记录矛盾:此段落存在两个版本。
        </div>
      </div>
    </section>
  )
}

export default LayerStackSample
