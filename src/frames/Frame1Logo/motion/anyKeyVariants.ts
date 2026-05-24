import { ANY_KEY_BLINK_MS } from "../../../tokens"

// "按任意键开始探索" 闪烁动画 variants

export const anyKeyInitial = { opacity: 0 }

export const anyKeyAnimate = {
  opacity: [0.4, 1, 0.4],
  transition: {
    duration: ANY_KEY_BLINK_MS / 1000,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
}

export const anyKeyExit = {
  opacity: 0,
  transition: { duration: 0.25, ease: "easeOut" as const },
}
