import { useEffect, useRef, useCallback } from 'react'
import { readingBlocks } from '../data/novel'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
import {
  LEGACY_READER_END_TOLERANCE_PX,
  canCompleteLegacyReader,
  isAtLegacyReaderDocumentEnd,
  isLegacyReaderDownwardScrollIntent,
} from '../reader/legacyReaderCompletion'
import './Reader.css'
import ReaderProgress from '../components/ReaderProgress'

function scrollToY(y) {
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0)
  window.scrollTo({ top: Math.min(Math.max(y, 0), maxScroll), behavior: 'auto' })
}

function Reader({ onReaderReady }) {
  const language = useProgressStore(s => s.language)
  const transitionTo = useTransitionStore(s => s.transitionTo)
  const currentReadingPhase = useProgressStore(s => s.currentReadingPhase)
  const centerUnlocked = useProgressStore(s => s.centerUnlocked)
  const setLastScrollY = useProgressStore(s => s.setLastScrollY)

  const readerReadyRef = useRef(onReaderReady)
  readerReadyRef.current = onReaderReady

  const blockRefs = useRef([])
  const visibleBlocks = useRef(new Set())
  const sentinelRef = useRef(null)
  const phaseObserverRef = useRef(null)
  const sentinelObserverRef = useRef(null)
  const debounceRef = useRef(null)
  const scrollFrameRef = useRef(null)
  const restoringRef = useRef(true)
  const scrollPersistenceReadyRef = useRef(false)
  const restorePlanRef = useRef(null)
  const readerReadyStateRef = useRef(false)
  const userScrolledDownAfterReadyRef = useRef(false)
  const pendingUserDownIntentRef = useRef(false)
  const completionCommittedRef = useRef(false)
  const sentinelIntersectingRef = useRef(false)
  const lastStableScrollYRef = useRef(0)
  const touchStartYRef = useRef(null)
  const ignoreScrollIntentRef = useRef(true)
  const resizeFrameRef = useRef(null)

  if (restorePlanRef.current === null) {
    const state = useProgressStore.getState()
    restorePlanRef.current = {
      resumeRequested: state.resumeRequested,
      lastScrollY: state.lastScrollY,
      resumePhase: state.lastReadPhase ?? state.maxReadPhase,
    }
  }

  const scrollToPhase = useCallback((phase) => {
    const idx = readingBlocks.findIndex(b => b.phase === phase)
    if (idx >= 0 && blockRefs.current[idx]) {
      blockRefs.current[idx].scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [])

  const attemptLegacyCompletion = useCallback(() => {
    const state = useProgressStore.getState()
    const sentinelRect = sentinelRef.current?.getBoundingClientRect()
    const isSentinelAtEnd = sentinelIntersectingRef.current
      || Boolean(sentinelRect && sentinelRect.top <= window.innerHeight + LEGACY_READER_END_TOLERANCE_PX)
    const isAtDocumentEnd = isAtLegacyReaderDocumentEnd({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
    })

    const canComplete = canCompleteLegacyReader({
      isReaderReady: readerReadyStateRef.current,
      isRestoring: restoringRef.current,
      currentPhase: state.currentReadingPhase,
      hasUserScrolledDownAfterReady: userScrolledDownAfterReadyRef.current,
      isAtDocumentEnd,
      isSentinelAtEnd,
      readerCompleted: state.readerCompleted,
      centerUnlocked: state.centerUnlocked,
      completionCommitted: completionCommittedRef.current,
    })

    if (!canComplete) return false

    completionCommittedRef.current = true
    state.completeM4()
    return true
  }, [])

  const markUserDownIntent = useCallback(() => {
    if (!readerReadyStateRef.current || restoringRef.current) return
    userScrolledDownAfterReadyRef.current = true
    pendingUserDownIntentRef.current = true
    attemptLegacyCompletion()
  }, [attemptLegacyCompletion])

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.isTrusted && event.deltaY > 0) markUserDownIntent()
    }

    const handleKeyDown = (event) => {
      if (!event.isTrusted) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('button, input, select, textarea, [contenteditable="true"]')) return

      const isDownKey = event.key === 'ArrowDown'
        || event.key === 'PageDown'
        || (event.key === ' ' && !event.shiftKey)
      if (isDownKey) markUserDownIntent()
    }

    const handleTouchStart = (event) => {
      if (!event.isTrusted) return
      touchStartYRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event) => {
      if (!event.isTrusted || touchStartYRef.current === null) return
      const currentY = event.touches[0]?.clientY
      if (typeof currentY === 'number' && touchStartYRef.current - currentY > 12) {
        touchStartYRef.current = currentY
        markUserDownIntent()
      }
    }

    const handleResize = () => {
      pendingUserDownIntentRef.current = false
      ignoreScrollIntentRef.current = true
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = requestAnimationFrame(() => {
        lastStableScrollYRef.current = window.scrollY
        ignoreScrollIntentRef.current = false
        resizeFrameRef.current = null
      })
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('resize', handleResize)
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      touchStartYRef.current = null
      pendingUserDownIntentRef.current = false
    }
  }, [markUserDownIntent])

  useEffect(() => {
    const handleScroll = () => {
      if (restoringRef.current || !scrollPersistenceReadyRef.current) return

      const state = useProgressStore.getState()
      if (state.currentView !== 'reader') return

      if (document.documentElement.scrollHeight <= window.innerHeight + 20) return

      if (scrollFrameRef.current === null) {
        scrollFrameRef.current = requestAnimationFrame(() => {
          scrollFrameRef.current = null
          if (restoringRef.current || !scrollPersistenceReadyRef.current) return

          const latestState = useProgressStore.getState()
          if (latestState.currentView !== 'reader') return
          if (document.documentElement.scrollHeight <= window.innerHeight + 20) return

          const currentScrollY = window.scrollY
          const movedDown = isLegacyReaderDownwardScrollIntent({
            isReaderReady: readerReadyStateRef.current,
            isRestoring: restoringRef.current,
            ignoreScrollIntent: ignoreScrollIntentRef.current,
            previousScrollY: lastStableScrollYRef.current,
            currentScrollY,
          })
          lastStableScrollYRef.current = currentScrollY
          setLastScrollY(currentScrollY)

          if (movedDown) {
            userScrolledDownAfterReadyRef.current = true
            attemptLegacyCompletion()
            pendingUserDownIntentRef.current = false
          }
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)

      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }

      const isScrollable = document.documentElement.scrollHeight > window.innerHeight + 20
      if (scrollPersistenceReadyRef.current && !restoringRef.current && isScrollable) {
        setLastScrollY(window.scrollY)
      }

      scrollPersistenceReadyRef.current = false
      readerReadyStateRef.current = false
      ignoreScrollIntentRef.current = true
    }
  }, [attemptLegacyCompletion, setLastScrollY])

  useEffect(() => {
    phaseObserverRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibleBlocks.current.add(entry.target)
        } else {
          visibleBlocks.current.delete(entry.target)
        }
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const vph = window.innerHeight
        const vpCenter = vph / 2
        let bestBlock = null
        let bestDist = Infinity

        for (const el of visibleBlocks.current) {
          const rect = el.getBoundingClientRect()
          const blockCenter = rect.top + rect.height / 2
          const dist = Math.abs(blockCenter - vpCenter)
          if (dist < bestDist) {
            bestDist = dist
            bestBlock = el
          }
        }

        if (bestBlock) {
          const phase = bestBlock.dataset.phase
          const state = useProgressStore.getState()
          if (phase !== state.currentReadingPhase) {
            state.setPhase(phase)
          }
        }
      }, 200)
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] })

    for (const el of blockRefs.current) {
      if (el) phaseObserverRef.current.observe(el)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      phaseObserverRef.current?.disconnect()
    }
  }, [])

  useEffect(() => {
    sentinelObserverRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        sentinelIntersectingRef.current = entry.isIntersecting
        if (entry.isIntersecting && readerReadyStateRef.current && !restoringRef.current) {
          useProgressStore.getState().setPhase('M4')
        }
      }
    }, { threshold: 0 })

    if (sentinelRef.current) {
      sentinelObserverRef.current.observe(sentinelRef.current)
    }

    return () => {
      sentinelObserverRef.current?.disconnect()
      sentinelIntersectingRef.current = false
    }
  }, [])

  useEffect(() => {
    const frameIds = []
    let cancelled = false
    const plan = restorePlanRef.current

    restoringRef.current = true
    readerReadyStateRef.current = false
    scrollPersistenceReadyRef.current = false
    pendingUserDownIntentRef.current = false
    ignoreScrollIntentRef.current = true

    const scheduleFrame = (callback) => {
      const id = requestAnimationFrame(() => {
        if (!cancelled) callback()
      })
      frameIds.push(id)
    }

    const finishRestore = () => {
      if (cancelled) return
      restoringRef.current = false
      readerReadyStateRef.current = true
      lastStableScrollYRef.current = window.scrollY
      ignoreScrollIntentRef.current = false
      readerReadyRef.current?.()
      scrollPersistenceReadyRef.current = true
    }

    if (plan.resumeRequested) {
      useProgressStore.getState().clearResumeRequest()

      if (plan.lastScrollY > 0) {
        scheduleFrame(() => {
          scheduleFrame(() => {
            scrollToY(plan.lastScrollY)
            scheduleFrame(finishRestore)
          })
        })
      } else {
        if (plan.resumePhase) scrollToPhase(plan.resumePhase)
        scheduleFrame(finishRestore)
      }
    } else {
      scheduleFrame(finishRestore)
    }

    return () => {
      cancelled = true
      for (const id of frameIds) cancelAnimationFrame(id)
      restoringRef.current = true
      readerReadyStateRef.current = false
      scrollPersistenceReadyRef.current = false
      pendingUserDownIntentRef.current = false
      ignoreScrollIntentRef.current = true
    }
  }, [scrollToPhase])

  const t = copy[language]

  return (
    <div className="reader-page">
      <div className="reader">
        <div className="reader-top-actions">
          <button className="reader-text-link" onClick={() => transitionTo('landing', { preset: 'reader-to-surface' })}>
            {t.backToLanding}
          </button>
          {centerUnlocked && (
            <button className="reader-text-link reader-text-link--reveal" onClick={() => transitionTo('center', { preset: 'reader-to-core' })}>
              {t.enterCenter}
            </button>
          )}
        </div>

        <ReaderProgress />

        {currentReadingPhase && (
          <div className="reader-phase-tag">{currentReadingPhase}</div>
        )}

        {readingBlocks.map((block, i) => (
          <div
            key={block.id}
            ref={el => blockRefs.current[i] = el}
            className="reader-block"
            data-phase={block.phase}
          >
            {block.paragraphs.map((p, j) => (
              <p key={j} className="reader-paragraph">{p}</p>
            ))}
          </div>
        ))}

        <div ref={sentinelRef} data-sentinel="end" className="reader-sentinel" />

        <div className="reader-bottom-actions">
          <button className="reader-text-link" onClick={() => transitionTo('landing', { preset: 'reader-to-surface' })}>
            {t.backToLanding}
          </button>
          {centerUnlocked && (
            <button className="reader-text-link reader-text-link--reveal" onClick={() => transitionTo('center', { preset: 'reader-to-core' })}>
              {t.enterCenter}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reader
