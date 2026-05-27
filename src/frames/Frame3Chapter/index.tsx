import { useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { defaultAdapter } from "../../content"
import { useLanguageStore } from "../../store/useLanguageStore"
import type {
  ChapterParagraph,
  ChapterParagraphType,
} from "../../types/chapter"

const FOCUS_RANGE = 0.55
const MIN_OPACITY = 0.04
const MAX_TRANSLATE = 24

const PARA_STYLE: Record<ChapterParagraphType, CSSProperties> = {
  open:     { fontSize: 26, lineHeight: 1.5, marginBottom: "28vh", textAlign: "center" },
  narrate:  { fontSize: 18, lineHeight: 1.9, marginBottom: "1.5em", maxWidth: 480, textAlign: "left", marginLeft: "auto", marginRight: "auto" },
  key:      { fontSize: 22, lineHeight: 1.5, marginBottom: "22vh", textAlign: "center" },
  thought:  { fontSize: 18, lineHeight: 1.8, marginBottom: "14vh", fontStyle: "italic", textAlign: "center", opacity: 0.85 },
  dialogue: { fontSize: 22, lineHeight: 1.7, marginBottom: "14vh", textAlign: "center" },
  pause:    { fontSize: 22, lineHeight: 1.5, marginBottom: "25vh", letterSpacing: "0.18em", fontStyle: "italic", textAlign: "center", opacity: 0.6 },
}

const CONTAINER: CSSProperties = {
  position: "fixed",
  inset: 0,
  overflowY: "auto",
  background: "var(--color-bg)",
  color: "var(--color-fg)",
  fontFamily: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif',
  zIndex: 0,
}

const SPACE: CSSProperties = {
  maxWidth: 580,
  margin: "0 auto",
  padding: "40vh 24px 25vh",
}

type Props = { chapterId: string }

export function Frame3Chapter({ chapterId }: Props) {
  const lang = useLanguageStore((s) => s.lang)
  const chapter = useMemo(
    () => defaultAdapter.getChapterById(chapterId),
    [chapterId],
  )

  const paraRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const [styles, setStyles] = useState<Array<{ opacity: number; ty: number }>>([])

  useLayoutEffect(() => {
    let raf = 0
    const tick = () => {
      const vh = window.innerHeight
      const center = vh / 2
      const range = vh * FOCUS_RANGE
      const next = paraRefs.current.map((el) => {
        if (!el) return { opacity: MIN_OPACITY, ty: 0 }
        const rect = el.getBoundingClientRect()
        const elCenter = rect.top + rect.height / 2
        const dist = Math.abs(elCenter - center)
        const t = Math.min(1, dist / range)
        const opacity = MIN_OPACITY + (1 - MIN_OPACITY) * (1 - t * t)
        const ty = t * MAX_TRANSLATE * Math.sign(elCenter - center)
        return { opacity, ty }
      })
      setStyles(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [chapter?.id])

  if (!chapter) {
    return (
      <div style={CONTAINER} className="scroll-invisible">
        <div style={SPACE}>章节不存在: {chapterId}</div>
      </div>
    )
  }

  const paragraphs: ChapterParagraph[] = chapter.paragraphs ?? []

  return (
    <div style={CONTAINER} className="scroll-invisible">
      <div style={SPACE}>
        {paragraphs.map((p, i) => {
          const s = styles[i] ?? { opacity: MIN_OPACITY, ty: 0 }
          const baseStyle = PARA_STYLE[p.type]
          const baseOpacity = (baseStyle.opacity as number | undefined) ?? 1
          const text = p.text[lang] ?? p.text.zh
          return (
            <p
              key={i}
              ref={(el) => {
                paraRefs.current[i] = el
              }}
              style={{
                ...baseStyle,
                opacity: s.opacity * baseOpacity,
                transform: `translateY(${s.ty}px)`,
                transition: "opacity 0.18s linear, transform 0.18s linear",
              }}
            >
              {text}
            </p>
          )
        })}
      </div>
    </div>
  )
}
