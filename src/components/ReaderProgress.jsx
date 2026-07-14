import { useEffect, useRef, useState } from 'react'
import './ReaderProgress.css'

function ReaderProgress() {
  const [progress, setProgress] = useState(0)
  const ticking = useRef(false)

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight
      const maxScroll = scrollHeight - clientHeight
      const p = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 0
      setProgress(p)
    }

    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(() => {
          update()
          ticking.current = false
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="reader-progress" aria-hidden="true">
      <div className="reader-progress-track">
        <div
          className="reader-progress-fill"
          style={{ height: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

export default ReaderProgress
