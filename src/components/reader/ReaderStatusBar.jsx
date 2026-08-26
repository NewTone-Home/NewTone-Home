import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getReaderEnvironmentStatus, getReaderSceneLabel } from '../../i18n/readerUi'
import './ReaderStatusBar.css'

const STATUS_FIELDS = Object.freeze(['world', 'location', 'time', 'weather'])
const STATUS_FIELD_ANIMATION_MS = 1100
const STATUS_BAR_ENTER_MS = 700
const STATUS_BAR_EXIT_MS = 560

function ReaderStatusBar({ language, state, visible = true, style }) {
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
  const presenceInitializedRef = useRef(false)
  const [changingFields, setChangingFields] = useState(() => new Set())
  const [presencePhase, setPresencePhase] = useState(() => (visible ? 'entering' : 'hidden'))

  useEffect(() => {
    const previousValues = previousValuesRef.current
    const changedFields = STATUS_FIELDS.filter(field => previousValues[field] !== values[field])
    previousValuesRef.current = values
    if (!changedFields.length) return undefined

    setChangingFields(current => {
      const next = new Set(current)
      changedFields.forEach(field => next.add(field))
      return next
    })

    changedFields.forEach(field => {
      const previousTimer = fieldTimersRef.current.get(field)
      if (previousTimer) window.clearTimeout(previousTimer)
      const timer = window.setTimeout(() => {
        setChangingFields(current => {
          if (!current.has(field)) return current
          const next = new Set(current)
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

  useEffect(() => {
    if (!visible && !presenceInitializedRef.current) {
      presenceInitializedRef.current = true
      return undefined
    }
    presenceInitializedRef.current = true
    const duration = visible ? STATUS_BAR_ENTER_MS : STATUS_BAR_EXIT_MS
    setPresencePhase(visible ? 'entering' : 'exiting')
    const timer = window.setTimeout(() => setPresencePhase(visible ? 'visible' : 'hidden'), duration)
    return () => window.clearTimeout(timer)
  }, [visible])

  const renderField = (field, fieldValues, className = '', title, animate = false) => (
    <span
      key={`${field}:${fieldValues[field]}`}
      className={`reader-status-bar__item${className ? ` ${className}` : ''}${animate && changingFields.has(field) ? ' is-changing' : ''}`}
      title={title}
    >
      <span className="reader-status-bar__value">{fieldValues[field]}</span>
    </span>
  )

  const renderContent = (fieldValues, animate = false) => (
    <span
      className="reader-status-bar__content"
    >
      {renderField('world', fieldValues, 'reader-status-bar__world', undefined, animate)}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('location', fieldValues, 'reader-status-bar__location', fieldValues.location, animate)}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('time', fieldValues, '', undefined, animate)}
      <span className="reader-status-bar__divider" aria-hidden="true">|</span>
      {renderField('weather', fieldValues, '', undefined, animate)}
    </span>
  )

  const statusBar = (
    <div
      className={`reader-status-bar is-${presencePhase}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      style={style}
      aria-label={`${values.world}, ${values.location}, ${values.time}, ${values.weather}`}
      data-reader-status-world={state.worldLayer}
      data-reader-status-location={state.locationId}
      data-reader-status-time={state.time}
      data-reader-status-weather={state.weather}
      data-reader-status-visible={visible ? 'true' : 'false'}
    >
      {renderContent(values, true)}
    </div>
  )

  return typeof document === 'undefined' ? statusBar : createPortal(statusBar, document.body)
}

export default memo(ReaderStatusBar)
