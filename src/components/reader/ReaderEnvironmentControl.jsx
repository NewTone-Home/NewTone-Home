import { READER_ENVIRONMENT_OPTIONS } from '../../data/reader-experiments/readerEnvironmentPreview'

function OptionGroup({ label, options, value, onChange }) {
  return (
    <fieldset className="reader-environment-control-group">
      <legend>{label}</legend>
      <div className="reader-environment-control-options">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'is-active' : ''}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ReaderEnvironmentControl({ value, nativeValue, onChange, onReset }) {
  return (
    <aside className="reader-environment-control" aria-label="Reader 环境预览控制">
      <div className="reader-environment-control-heading">
        <span>环境预览</span>
        <button type="button" onClick={onReset} disabled={!value}>跟随章节</button>
      </div>
      <OptionGroup
        label="世界"
        options={READER_ENVIRONMENT_OPTIONS.worldLayers}
        value={(value ?? nativeValue).worldLayer}
        onChange={worldLayer => onChange({ ...(value ?? nativeValue), worldLayer })}
      />
      <OptionGroup
        label="时间"
        options={READER_ENVIRONMENT_OPTIONS.times}
        value={(value ?? nativeValue).time}
        onChange={time => onChange({ ...(value ?? nativeValue), time })}
      />
      <OptionGroup
        label="天气"
        options={READER_ENVIRONMENT_OPTIONS.weather}
        value={(value ?? nativeValue).weather}
        onChange={weather => onChange({ ...(value ?? nativeValue), weather })}
      />
      <p>{value ? '预览覆盖中 · 不写入章节状态' : '当前跟随章节状态'}</p>
    </aside>
  )
}

export default ReaderEnvironmentControl
