// 两按钮淡入 variants

export const buttonsInitial = { opacity: 0, y: 12 }

export const buttonsAnimate = {
  opacity: 1,
  y: 0,
  transition: { duration: 0.6, ease: "easeOut" as const },
}

export const buttonsExit = {
  opacity: 0,
  transition: { duration: 0.25, ease: "easeOut" as const },
}
