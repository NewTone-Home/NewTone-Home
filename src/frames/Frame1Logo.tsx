import { motion } from "framer-motion"
import { useEffect } from "react"
import { useEntryStore } from "../store/useEntryStore"
import { HeartbeatDot } from "../components/HeartbeatDot"
import type { EntryDestination } from "../types/entry"
import { MOTION } from "../tokens/motion"

const CONTAINER_STYLE: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  position: "relative",
}

const LOGO_FULL_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: 56,
  fontWeight: 300,
  letterSpacing: "0.08em",
  color: "#111",
  marginBottom: 80,
}

const LOGO_TRANSIENT_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: 56,
  fontWeight: 300,
  letterSpacing: "0.08em",
  color: "#111",
  marginBottom: 0,
}

const BUTTONS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: 32,
}

const BUTTON_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #111",
  padding: "12px 28px",
  fontFamily: '"Noto Serif SC", serif',
  fontSize: 16,
  color: "#111",
  cursor: "pointer",
  letterSpacing: "0.05em",
  transition: "all 0.2s ease",
}

const DEV_RESET_STYLE: React.CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  background: "rgba(0,0,0,0.05)",
  border: "1px dashed rgba(0,0,0,0.3)",
  padding: "4px 10px",
  fontSize: 11,
  fontFamily: "monospace",
  color: "#666",
  cursor: "pointer",
  borderRadius: 4,
}

const LOGO_INIT = { opacity: 0, y: 8 }
const LOGO_SHOW = { opacity: 1, y: 0 }
const LOGO_TRANS = { duration: 0.8, ease: "easeOut" as const }
const BTN_ROW_INIT = { opacity: 0, y: 12 }
const BTN_ROW_SHOW = { opacity: 1, y: 0 }
const BTN_ROW_TRANS = { duration: 0.8, ease: "easeOut" as const, delay: 0.4 }

interface Props {
  variant: "full" | "transient"
  transientNext?: EntryDestination
}

export function Frame1Logo({ variant, transientNext }: Props) {
  const chooseFirstEntry = useEntryStore((s) => s.chooseFirstEntry)
  const goTo = useEntryStore((s) => s.goTo)

  useEffect(() => {
    if (variant === "transient" && transientNext) {
      const t = window.setTimeout(() => {
        goTo(transientNext)
      }, MOTION.transientLogoDurationMs)
      return () => window.clearTimeout(t)
    }
  }, [variant, transientNext, goTo])

  function handleBtnEnter(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.background = "#111"
    e.currentTarget.style.color = "#fff"
  }
  function handleBtnLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.background = "transparent"
    e.currentTarget.style.color = "#111"
  }

  return (
    <div style={CONTAINER_STYLE}>
      <motion.div
        initial={LOGO_INIT}
        animate={LOGO_SHOW}
        transition={LOGO_TRANS}
        style={variant === "full" ? LOGO_FULL_STYLE : LOGO_TRANSIENT_STYLE}
      >
        NewTone
      </motion.div>

      {variant === "full" && (
        <motion.div
          initial={BTN_ROW_INIT}
          animate={BTN_ROW_SHOW}
          transition={BTN_ROW_TRANS}
          style={BUTTONS_ROW_STYLE}
        >
          <button
            onClick={() => chooseFirstEntry("linear")}
            style={BUTTON_STYLE}
            onMouseEnter={handleBtnEnter}
            onMouseLeave={handleBtnLeave}
          >
            从头开始
          </button>
          <button
            onClick={() => chooseFirstEntry("free_explore")}
            style={BUTTON_STYLE}
            onMouseEnter={handleBtnEnter}
            onMouseLeave={handleBtnLeave}
          >
            我已来过
          </button>
        </motion.div>
      )}

      {variant === "full" && <HeartbeatDot />}

      <DevResetButton />
    </div>
  )
}

function DevResetButton() {
  const reset = useEntryStore((s) => s.resetStorage)
  return (
    <button
      onClick={() => {
        reset()
        window.location.reload()
      }}
      style={DEV_RESET_STYLE}
    >
      🔧 dev: reset localStorage
    </button>
  )
}
