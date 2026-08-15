import { useCallback, useEffect, useRef } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import { UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

const LANDING_UPDATES = Object.freeze({
  date: '2026.08.15',
  dateTime: '2026-08-15',
  zh: Object.freeze({
    title: '更新公告',
    timelineAriaLabel: '公告时间线',
    returnLabel: '返回入口',
    returnAriaLabel: '返回 NewTone',
    body: Object.freeze([
      '本次更新没有加入新的宇宙，也没有打开什么神秘入口。',
      '我们只是终于认真处理了一下那些“理论上能用，实际用起来总觉得哪里不太对”的东西。',
      '优化并重新设计了交互的逻辑与视觉效果',
      '改善了多个设备运行表现',
    ]),
  }),
  en: Object.freeze({
    title: 'UPDATES',
    timelineAriaLabel: 'Updates timeline',
    returnLabel: 'BACK',
    returnAriaLabel: 'Return to NewTone',
    body: Object.freeze([
      'No new universe this time. No secret doorway, either.',
      'We simply took a proper look at the things that were technically working, but never quite felt right in practice.',
      'We refined and redesigned the logic and visual language of the interactions.',
      'We also improved performance across a wider range of devices.',
    ]),
  }),
})

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function LandingUpdatesPage({ phase, language = 'zh', onSurfaceComplete, onReturnRequested }) {
  const returnIssuedRef = useRef(false)
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES
  const content = language === 'zh' ? LANDING_UPDATES.zh : LANDING_UPDATES.en

  useEffect(() => {
    if (phase === UPDATES_PHASE.LANDING) returnIssuedRef.current = false
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

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      onAnimationEnd={handleSurfaceAnimationEnd}
    >
      <div className="landing-updates-page__layout">
        <aside className="landing-updates-page__timeline" aria-label={content.timelineAriaLabel}>
          <div className="landing-updates-page__timeline-line" aria-hidden="true" />
          <div className="landing-updates-page__timeline-entry">
            <time
              className="landing-updates-page__timeline-date"
              dateTime={LANDING_UPDATES.dateTime}
            >
              {LANDING_UPDATES.date}
            </time>
            <span className="landing-updates-page__timeline-dot" aria-hidden="true" />
          </div>
        </aside>

        <article className="landing-updates-page__content">
          <h1>{content.title}</h1>
          <time className="landing-updates-page__date" dateTime={LANDING_UPDATES.dateTime}>
            {LANDING_UPDATES.date}
          </time>
          <div className="landing-updates-page__body">
            {content.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </article>
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
