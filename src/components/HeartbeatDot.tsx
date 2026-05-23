import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { DOT_SIZE_PX, HIT_AREA_PX, MOTION } from "../tokens/motion"

const WRAPPER_STYLE: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  width: HIT_AREA_PX,
  height: HIT_AREA_PX,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const DOT_STYLE: React.CSSProperties = {
  width: DOT_SIZE_PX,
  height: DOT_SIZE_PX,
  borderRadius: "50%",
  background: "#111",
}

const ICONS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  fontSize: 14,
  fontFamily: '"Noto Serif SC", serif',
  color: "#111",
}

const ICON_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  color: "inherit",
}

const FADE_IN = { opacity: 0 }
const FADE_TO_ONE = { opacity: 1 }
const FADE_DURATION = { duration: 0.28 }
const ICON_INIT = { opacity: 0, y: 4 }
const ICON_SHOW = { opacity: 0.7, y: 0 }
const ICON_T1 = { duration: 0.28, delay: 0 }
const ICON_T2 = { duration: 0.28, delay: 0.06 }
const BREATH_INIT = { opacity: 0 }
const BREATH_ANIM = { opacity: [0.06, 0.15, 0.06] }
const BREATH_TRANS = { duration: 7, repeat: Infinity, ease: "easeInOut" as const }

export function HeartbeatDot() {
  const [expanded, setExpanded] = useState(false)
  const enterTimer = useRef<number | null>(null)
  const exitTimer = useRef<number | null>(null)

  function handleEnter() {
    if (exitTimer.current) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    enterTimer.current = window.setTimeout(() => setExpanded(true), MOTION.enterDelayMs)
  }

  function handleLeave() {
    if (enterTimer.current) {
      window.clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
    exitTimer.current = window.setTimeout(() => setExpanded(false), MOTION.exitGraceMs)
  }

  useEffect(() => {
    return () => {
      if (enterTimer.current) window.clearTimeout(enterTimer.current)
      if (exitTimer.current) window.clearTimeout(exitTimer.current)
    }
  }, [])

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={WRAPPER_STYLE}>
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="icons"
            initial={FADE_IN}
            animate={FADE_TO_ONE}
            exit={FADE_IN}
            transition={FADE_DURATION}
            style={ICONS_ROW_STYLE}
          >
            <motion.button
              initial={ICON_INIT}
              animate={ICON_SHOW}
              transition={ICON_T1}
              onClick={() => alert("语言切换（占位）")}
              style={ICON_BUTTON_STYLE}
              aria-label="切换语言"
            >
              文
            </motion.button>
            <motion.button
              initial={ICON_INIT}
              animate={ICON_SHOW}
              transition={ICON_T2}
              onClick={() => alert("主题切换（占位）")}
              style={ICON_BUTTON_STYLE}
              aria-label="切换主题"
            >
              ◐
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="dot"
            initial={BREATH_INIT}
            animate={BREATH_ANIM}
            exit={BREATH_INIT}
            transition={BREATH_TRANS}
            style={DOT_STYLE}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
