import { useEffect, useState } from "react"
import { INTRO_DURATION_MS } from "../../../tokens"
import type { Frame1Phase } from "../types"

// Phase 状态机
// intro (Logo 入场 800ms) → awaiting_key (等待用户按键)
// awaiting_key → ready 由外部按键/点击事件触发
export function useFrame1Phase() {
  const [phase, setPhase] = useState<Frame1Phase>("intro")

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("awaiting_key"), INTRO_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [])

  return { phase, setPhase }
}
