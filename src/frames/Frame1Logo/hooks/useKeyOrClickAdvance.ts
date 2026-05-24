import { useEffect } from "react"
import type { Frame1Phase } from "../types"

// awaiting_key 阶段监听键盘/点击触发 onAdvance
// 单纯修饰键（Shift/Ctrl/Alt/Meta）不触发
export function useKeyOrClickAdvance(phase: Frame1Phase, onAdvance: () => void) {
  useEffect(() => {
    if (phase !== "awaiting_key") return

    function onKey(e: KeyboardEvent) {
      const isModifier =
        e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta"
      if (isModifier) return
      onAdvance()
    }

    function onClick() {
      onAdvance()
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("click", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("click", onClick)
    }
  }, [phase, onAdvance])
}
