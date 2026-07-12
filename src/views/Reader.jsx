import { useEffect, useRef, useCallback } from 'react'
import { readingBlocks } from '../data/novel'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import { copy } from '../i18n/copy'
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
  const tickingRef = useRef(false)
  const restoringRef = useRef(false)

  const scrollToPhase = useCallback((phase) => {
    const idx = readingBlocks.findIndex(b => b.phase === phase)
    if (idx >= 0 && blockRefs.current[idx]) {
      blockRefs.current[idx].scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (restoringRef.current) return

      const state = useProgressStore.getState()
      if (state.currentView !== 'reader') return

      if (document.documentElement.scrollHeight <= window.innerHeight + 20) return

      if (!tickingRef.current) {
        tickingRef.current = true
        requestAnimationFrame(() => {
          setLastScrollY(window.scrollY)
          tickingRef.current = false
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      const isScrollable = document.documentElement.scrollHeight > window.innerHeight + 20
      if (isScrollable) {
        setLastScrollY(window.scrollY)
      }
      window.removeEventListener('scroll', handleScroll)
    }
  }, [setLastScrollY])

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
        if (entry.isIntersecting) {
          const state = useProgressStore.getState()
          state.setPhase('M4')
          state.completeM4()
        }
      }
    }, { threshold: 0 })

    if (sentinelRef.current) {
      sentinelObserverRef.current.observe(sentinelRef.current)
    }

    return () => {
      sentinelObserverRef.current?.disconnect()
    }
  }, [])

  useEffect(() => {
    const state = useProgressStore.getState()
    if (state.resumeRequested) {
      state.clearResumeRequest()

      if (state.lastScrollY > 0) {
        const y = state.lastScrollY
        restoringRef.current = true
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToY(y)
            requestAnimationFrame(() => {
              restoringRef.current = false
              readerReadyRef.current?.()
            })
          })
        })
      } else {
        const resumePhase = state.lastReadPhase ?? state.maxReadPhase
        if (resumePhase) scrollToPhase(resumePhase)
        requestAnimationFrame(() => readerReadyRef.current?.())
      }
    } else {
      requestAnimationFrame(() => readerReadyRef.current?.())
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
