import { AnimatePresence } from "framer-motion"
import { useCallback } from "react"
import { useEntryStore } from "../../store"
import { useFrame1Phase } from "./hooks/useFrame1Phase"
import { useKeyOrClickAdvance } from "./hooks/useKeyOrClickAdvance"
import { LogoText } from "./parts/LogoText"
import { AnyKeyHint } from "./parts/AnyKeyHint"
import { EntryButtons } from "./parts/EntryButtons"
import { containerStyle, slotStyle } from "./styles/container"
import type { Frame1LogoProps } from "./types"

// Frame 1 编排器（薄壳）
// - intro 阶段：仅 Logo 入场
// - awaiting_key 阶段：Logo + 闪烁提示，等待按键
// - ready 阶段：
//   * full → 揭示两按钮
//   * transient → 直接跳转到 transientNext
export function Frame1Logo({ variant, transientNext }: Frame1LogoProps) {
  const goTo = useEntryStore((s) => s.goTo)
  const { phase, setPhase } = useFrame1Phase()

  const handleAdvance = useCallback(() => {
    if (variant === "full") {
      setPhase("ready")
    } else if (variant === "transient" && transientNext) {
      goTo(transientNext)
    }
  }, [variant, transientNext, setPhase, goTo])

  useKeyOrClickAdvance(phase, handleAdvance)

  return (
    <div style={containerStyle}>
      <LogoText />
      <div style={slotStyle}>
        <AnimatePresence mode="wait">
          {phase === "awaiting_key" && <AnyKeyHint />}
          {phase === "ready" && variant === "full" && <EntryButtons />}
        </AnimatePresence>
      </div>
    </div>
  )
}
