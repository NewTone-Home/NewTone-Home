import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useEntryStore } from "../store/useEntryStore"
import { HeartbeatDot } from "../components/HeartbeatDot"
import type { EntryDestination } from "../types/entry"

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

const LOGO_STYLE: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", serif',
  fontSize: 56,
  fontWeight: 300,
  letterSpacing: "0.08em",
  color: "#111",
  marginBottom: 80,
}

const SLOT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
}

const ANY_KEY_STYLE: React.CSSProperties = {
  fontFamily: '"Noto Serif SC", serif',
  fontSize: 14,
  color: "#888",
  letterSpacing: "0.15em",
  userSelect: "none",
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

const LOGO_VAR_INITIAL = { opacity: 0, y: 8 }
const LOGO_VAR_ANIMATE = { opacity: 1, y: 0 }
const LOGO_VAR_TRANS = { duration: 0.8, ease: "easeOut" as const }

const ANYKEY_VAR_INITIAL = { opacity: 0 }
const ANYKEY_VAR_ANIMATE = {
  opacity: [0.4, 1, 0.4],
  transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const },
}
const ANYKEY_VAR_EXIT = {
  opacity: 0,
  transition: { duration: 0.25, ease: "easeOut" as const },
}

const BTNS_VAR_INITIAL = { opacity: 0, y: 12 }
const BTNS_VAR_ANIMATE = {
  opacity: 1,
  y: 0,
  transition: { duration: 0.6, ease: "easeOut" as const },
}
const BTNS_VAR_EXIT = {
  opacity: 0,
  transition: { duration: 0.25, ease: "easeOut" as const },
}

const INTRO_DURATION_MS = 800

type Phase = "intro" | "awaiting_key" | "ready"

interface Props {
  variant: "full" | "transient"
  transientNext?: EntryDestination
}

export function Frame1Logo({ variant, transientNext }: Props) {
  const chooseFirstEntry = useEntryStore((s) => s.chooseFirstEntry)
  const goTo = useEntryStore((s) => s.goTo)
  const [phase, setPhase] = useState<Phase>("intro")

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("awaiting_key"), INTRO_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== "awaiting_key") return

    function advance() {
      if (variant === "full") {
        setPhase("ready")
      } else if (variant === "transient" && transientNext) {
        goTo(transientNext)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return
      advance()
    }

    function onClick() {
      advance()
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("click", onClick)


    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("click", onClick)
    }
  }, [phase, variant, transientNext, goTo])

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
        initial={LOGO_VAR_INITIAL}
        animate={LOGO_VAR_ANIMATE}
        transition={LOGO_VAR_TRANS}
        style={LOGO_STYLE}
      >
        NewTone
      </motion.div>

      <div style={SLOT_STYLE}>
        <AnimatePresence mode="wait">
          {phase === "awaiting_key" && (
            <motion.div
              key="any-key"
              initial={ANYKEY_VAR_INITIAL}
              animate={ANYKEY_VAR_ANIMATE}
              exit={ANYKEY_VAR_EXIT}
              style={ANY_KEY_STYLE}
            >
              按任意键开始探索
            </motion.div>
          )}

          {phase === "ready" && variant === "full" && (
            <motion.div
              key="buttons"
              initial={BTNS_VAR_INITIAL}
              animate={BTNS_VAR_ANIMATE}
              exit={BTNS_VAR_EXIT}
              style={BUTTONS_ROW_STYLE}
            >
              <button
                onClick={(e) => { e.stopPropagation(); chooseFirstEntry("linear") }}
                style={BUTTON_STYLE}
                onMouseEnter={handleBtnEnter}
                onMouseLeave={handleBtnLeave}
              >
                从头开始
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); chooseFirstEntry("free_explore") }}
                style={BUTTON_STYLE}
                onMouseEnter={handleBtnEnter}
                onMouseLeave={handleBtnLeave}
              >
                我已来过
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {variant === "full" && phase === "ready" && <HeartbeatDot />}

      <DevResetButton />
    </div>
  )
}

function DevResetButton() {
  const reset = useEntryStore((s) => s.resetStorage)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        reset()
        window.location.reload()
      }}
      style={DEV_RESET_STYLE}
    >
      🔧 dev: reset localStorage
    </button>
  )
}
