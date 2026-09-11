import { memo, useEffect, useRef, useState } from 'react'
import { getReaderEnvironmentStatus, getReaderSceneLabel } from '../../i18n/readerUi'
import './ReaderStatusBar.css'

const STATUS_FIELDS = Object.freeze(['world', 'location', 'time', 'weather'])
const STATUS_FIELD_ANIMATION_MS = 1200

function ReaderStatusBar({ language, state, lifecyclePhase = 'visible', visible }) {
  const resolvedLifecyclePhase = visible === false ? 'hidden' : lifecyclePhase
  const status = getReaderEnvironmentStatus(language, state)
  const location = getReaderSceneLabel(
    language,
    state.locationId,
    state.locationLabels?.[language] || state.locationLabel,
  ) || (language === 'en' ? 'Unknown location' : '未知地点')
  const values = {
    world: status.world,
    location,
    time: status.time,
    weather: status.weather,
  }
  const previousValuesRef = useRef(values)
  const fieldTimersRef = useRef(new Map())
  const transitionSequenceRef = useRef(0)
  const [fieldTransitions, setFieldTransitions] = useState(() => new Map())

  useEffect(() => {
    const previousValues = previousValuesRef.current
    const changedFields = STATUS_FIELDS.filter(field => previousValues[field] !== values[field])
    previousValuesRef.current = values
    if (!changedFields.length) return undefined

    const changedTransitions = new Map()
    changedFields.forEach(field => {
      transitionSequenceRef.current += 1
      changedTransitions.set(field, {
        from: previousValues[field],
        to: values[field],
        key: `${field}:${transitionSequenceRef.current}`,
      })
    })

    setFieldTransitions(current => {
      const next = new Map(current)
      changedTransitions.forEach((transition, field) => next.set(field, transition))
      return next
    })

    changedFields.forEach(field => {
      const previousTimer = fieldTimersRef.current.get(field)
      if (previousTimer) window.clearTimeout(previousTimer)
      const transitionKey = changedTransitions.get(field).key
      const timer = window.setTimeout(() => {
        setFieldTransitions(current => {
          if (current.get(field)?.key !== transitionKey) return current
          const next = new Map(current)
          next.delete(field)
          return next
        })
        fieldTimersRef.current.delete(field)
      }, STATUS_FIELD_ANIMATION_MS)
      fieldTimersRef.current.set(field, timer)
    })

    return undefined
  }, [location, status.time, status.weather, status.world])

  useEffect(() => () => {
    fieldTimersRef.current.forEach(timer => window.clearTimeout(timer))
    fieldTimersRef.current.clear()
  }, [])

  const renderField = (field, fieldValues, className = '', title) => {
    const transition = fieldTransitions.get(field)

    return (
    <span
      key={field}
      className={`reader-status-bar__item${className ? ` ${className}` : ''}`}
      title={title}
    >
      {transition ? (
        <span className="reader-status-bar__flip" key={transition.key}>
          <span className="reader-status-bar__value reader-status-bar__value--old" aria-hidden="true">
            {transition.from}
          </span>
          <span className="reader-status-bar__value reader-status-bar__value--new">
            {transition.to}
          </span>
        </span>
      ) : (
        <span className="reader-status-bar__value">{fieldValues[field]}</span>
      )}
    </span>
    )
  }

  const renderContent = (fieldValues) => (
    <span
      className="reader-status-bar__content"
    >
      {renderField('world', fieldValues, 'reader-status-bar__world')}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('location', fieldValues, 'reader-status-bar__location', fieldValues.location)}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('time', fieldValues)}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('weather', fieldValues)}
    </span>
  )

  const statusBar = (
    <div
      className={`reader-status-bar is-${resolvedLifecyclePhase}`}
      role="status"
      aria-live="polite"
      aria-hidden={resolvedLifecyclePhase === 'hidden'}
      aria-label={`${values.world}, ${values.location}, ${values.time}, ${values.weather}`}
      data-reader-status-world={state.worldLayer}
      data-reader-status-location={state.locationId}
      data-reader-status-time={state.time}
      data-reader-status-weather={state.weather}
      data-reader-status-phase={resolvedLifecyclePhase}
      data-reader-status-visible={resolvedLifecyclePhase === 'hidden' ? 'false' : 'true'}
    >
      {renderContent(values)}
    </div>
  )

  return statusBar
}

export default memo(ReaderStatusBar)
