import { memo } from 'react'
import { getReaderEnvironmentStatus, getReaderSceneLabel } from '../../i18n/readerUi'
import './ReaderStatusBar.css'

function ReaderStatusBar({ language, state }) {
  const status = getReaderEnvironmentStatus(language, state)
  const location = getReaderSceneLabel(
    language,
    state.locationId,
    state.locationLabels?.[language] || state.locationLabel,
  ) || (language === 'en' ? 'Unknown location' : '未知地点')
  const statusKey = [language, state.worldLayer, state.locationId, state.time, state.weather].join(':')

  return (
    <div
      className="reader-status-bar"
      role="status"
      aria-live="polite"
      aria-label={`${status.world}, ${location}, ${status.time}, ${status.weather}`}
      data-reader-status-world={state.worldLayer}
      data-reader-status-location={state.locationId}
      data-reader-status-time={state.time}
      data-reader-status-weather={state.weather}
    >
      <span key={statusKey} className="reader-status-bar__content">
        <span className="reader-status-bar__item reader-status-bar__world">{status.world}</span>
        <span className="reader-status-bar__divider" aria-hidden="true">|</span>
        <span className="reader-status-bar__item reader-status-bar__location" title={location}>{location}</span>
        <span className="reader-status-bar__divider" aria-hidden="true">|</span>
        <span className="reader-status-bar__item">{status.time}</span>
        <span className="reader-status-bar__divider" aria-hidden="true">|</span>
        <span className="reader-status-bar__item">{status.weather}</span>
      </span>
    </div>
  )
}

export default memo(ReaderStatusBar)
