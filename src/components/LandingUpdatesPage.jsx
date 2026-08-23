import { useCallback, useEffect, useRef, useState } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

const LANDING_UPDATES = Object.freeze({
  date: '2026.08.23',
  dateTime: '2026-08-23',
  zh: Object.freeze({
    timelineAriaLabel: '公告时间线',
    expandLabel: '展开更新详情',
    collapseLabel: '收起更新详情',
    returnLabel: '返回入口',
    returnAriaLabel: '返回 NewTone',
    summary: Object.freeze([
      '合并了阅读模式，现在不再分成两个模式。',
      '优化了阅读体验。',
    ]),
    details: Object.freeze([
      '优化了操作体验。',
    ]),
  }),
  en: Object.freeze({
    timelineAriaLabel: 'Updates timeline',
    expandLabel: 'Expand update details',
    collapseLabel: 'Collapse update details',
    returnLabel: 'BACK',
    returnAriaLabel: 'Return to NewTone',
    summary: Object.freeze([
      'The reading modes are now combined into one, so there are no longer two separate modes.',
      'The reading experience has been improved.',
    ]),
    details: Object.freeze([
      'The interaction experience has been improved.',
    ]),
  }),
})

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function LandingUpdatesPage({ phase, language = 'zh', onSurfaceComplete, onReturnRequested }) {
  const returnIssuedRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES
  const content = language === 'zh' ? LANDING_UPDATES.zh : LANDING_UPDATES.en

  useEffect(() => {
    if (phase === UPDATES_PHASE.LANDING) {
      returnIssuedRef.current = false
      setExpanded(false)
    }
  }, [phase])

  const handleReturnComplete = useCallback(({ inputType }) => {
    if (!interactive || returnIssuedRef.current) return
    returnIssuedRef.current = true
    recordRuntimeAudit('updates-return-intent', {
      inputType,
      phase,
      source: 'button',
    })
    onReturnRequested?.()
  }, [interactive, onReturnRequested, phase])

  const handleSurfaceAnimationEnd = useCallback((event) => {
    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete?.()
  }, [onSurfaceComplete, phase])

  if (!visible) return null

  const toggleExpanded = () => {
    if (!interactive) return
    setExpanded(current => !current)
  }

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      onAnimationEnd={handleSurfaceAnimationEnd}
    >
      <div className="landing-updates-page__layout">
        <ol className="landing-updates-page__timeline" aria-label={content.timelineAriaLabel}>
          <li className={`landing-updates-page__timeline-entry${expanded ? ' is-expanded' : ''}`}>
            <div className="landing-updates-page__timeline-line" aria-hidden="true" />
            <button
              type="button"
              className="landing-updates-page__timeline-trigger"
              aria-controls="landing-updates-details"
              aria-expanded={expanded}
              aria-label={`${expanded ? content.collapseLabel : content.expandLabel} ${LANDING_UPDATES.date}`}
              disabled={!interactive}
              onClick={toggleExpanded}
            >
              <span className="landing-updates-page__timeline-dot" aria-hidden="true">
                {expanded ? '−' : '+'}
              </span>
              <span className="landing-updates-page__timeline-copy">
                <time
                  className="landing-updates-page__timeline-date"
                  dateTime={LANDING_UPDATES.dateTime}
                >
                  {LANDING_UPDATES.date}
                </time>
                <span className="landing-updates-page__summary">
                  {content.summary.map(line => <span key={line}>{line}</span>)}
                </span>
              </span>
            </button>

            <div
              id="landing-updates-details"
              className="landing-updates-page__details-shell"
              aria-hidden={!expanded}
            >
              <div className="landing-updates-page__details">
                {content.details.map(line => <p key={line}>{line}</p>)}
              </div>
            </div>
          </li>
        </ol>
      </div>

      <EntryButtonSurface
        visible={interactive}
        mobile={isCoarsePointer()}
        materialMode="background"
        entryId="landing-updates-return"
        label={content.returnLabel}
        ariaLabel={content.returnAriaLabel}
        className="landing-updates-return"
        onActionComplete={handleReturnComplete}
      />
    </section>
  )
}

export default LandingUpdatesPage
