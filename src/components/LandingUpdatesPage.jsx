import { useCallback, useEffect, useRef, useState } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

const LANDING_UPDATES = Object.freeze([
  Object.freeze({
    version: 'v0.1.2',
    date: '2026.08.23',
    dateTime: '2026-08-23',
    zh: Object.freeze({
      summary: Object.freeze([
        '这次没有加入新的宇宙，神秘入口正在筹备中。',
      ]),
      details: Object.freeze([
        '同时，我们把阅读模式合并成了一个，现在不再分成两个模式。',
        '并且优化了阅读体验和操作体验。',
      ]),
    }),
    en: Object.freeze({
      summary: Object.freeze([
        'No new universe was added this time. The mysterious entrance is still in the works.',
      ]),
      details: Object.freeze([
        'We combined the reading modes into one, so there are no longer two separate modes.',
        'We also improved the reading and interaction experience.',
      ]),
    }),
  }),
  Object.freeze({
    version: 'v0.1.1',
    date: '2026.08.15',
    dateTime: '2026-08-15',
    zh: Object.freeze({
      summary: Object.freeze([
        '本次更新没有加入新的宇宙，也没有打开什么神秘入口。',
        '我们只是终于认真处理了一下那些“理论上能用，实际用起来总觉得哪里不太对”的东西。',
      ]),
      details: Object.freeze([
        '优化并重新设计了交互的逻辑与视觉效果',
        '改善了多个设备运行表现',
      ]),
    }),
    en: Object.freeze({
      summary: Object.freeze([
        'No new universe this time. No secret doorway, either.',
        'We simply took a proper look at the things that were technically working, but never quite felt right in practice.',
      ]),
      details: Object.freeze([
        'We refined and redesigned the logic and visual language of the interactions.',
        'We also improved performance across a wider range of devices.',
      ]),
    }),
  }),
])

const UPDATE_UI_COPY = Object.freeze({
  zh: Object.freeze({
    timelineAriaLabel: '公告时间线',
    expandLabel: '展开更新详情',
    collapseLabel: '收起更新详情',
    returnLabel: '返回入口',
    returnAriaLabel: '返回 NewTone',
  }),
  en: Object.freeze({
    timelineAriaLabel: 'Updates timeline',
    expandLabel: 'Expand update details',
    collapseLabel: 'Collapse update details',
    returnLabel: 'BACK',
    returnAriaLabel: 'Return to NewTone',
  }),
})

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function LandingUpdatesPage({ phase, language = 'zh', onSurfaceComplete, onReturnRequested }) {
  const returnIssuedRef = useRef(false)
  const [expandedVersion, setExpandedVersion] = useState(null)
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES
  const uiCopy = UPDATE_UI_COPY[language] ?? UPDATE_UI_COPY.zh

  useEffect(() => {
    if (phase === UPDATES_PHASE.LANDING) {
      returnIssuedRef.current = false
      setExpandedVersion(null)
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

  const toggleExpanded = version => {
    if (!interactive) return
    setExpandedVersion(current => current === version ? null : version)
  }

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      onAnimationEnd={handleSurfaceAnimationEnd}
    >
      <div className="landing-updates-page__layout">
        <ol className="landing-updates-page__timeline" aria-label={uiCopy.timelineAriaLabel}>
          {LANDING_UPDATES.map(update => {
            const content = language === 'zh' ? update.zh : update.en
            const expanded = expandedVersion === update.version
            const detailsId = `landing-updates-details-${update.version.replaceAll('.', '-')}`
            return (
              <li className={`landing-updates-page__timeline-entry${expanded ? ' is-expanded' : ''}`} key={update.version}>
                <div className="landing-updates-page__timeline-line" aria-hidden="true" />
                <button
                  type="button"
                  className="landing-updates-page__timeline-trigger"
                  aria-controls={detailsId}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? uiCopy.collapseLabel : uiCopy.expandLabel} ${update.version}`}
                  disabled={!interactive}
                  onClick={() => toggleExpanded(update.version)}
                >
                  <span className="landing-updates-page__timeline-dot" aria-hidden="true">
                    {expanded ? '−' : '+'}
                  </span>
                  <span className="landing-updates-page__timeline-copy">
                    <span className="landing-updates-page__timeline-heading">
                      <span className="landing-updates-page__timeline-version">{update.version}</span>
                      <time
                        className="landing-updates-page__timeline-date"
                        dateTime={update.dateTime}
                      >
                        {update.date}
                      </time>
                    </span>
                    <span className="landing-updates-page__summary">
                      {content.summary.map(line => <span key={line}>{line}</span>)}
                    </span>
                  </span>
                </button>

                <div
                  id={detailsId}
                  className="landing-updates-page__details-shell"
                  aria-hidden={!expanded}
                >
                  <div className="landing-updates-page__details">
                    {content.details.map(line => <p key={line}>{line}</p>)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <EntryButtonSurface
        visible={interactive}
        mobile={isCoarsePointer()}
        materialMode="background"
        entryId="landing-updates-return"
        label={uiCopy.returnLabel}
        ariaLabel={uiCopy.returnAriaLabel}
        className="landing-updates-return"
        onActionComplete={handleReturnComplete}
      />
    </section>
  )
}

export default LandingUpdatesPage
