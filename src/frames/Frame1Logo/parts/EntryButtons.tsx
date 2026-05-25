import { motion } from "framer-motion"
import type { MouseEvent } from "react"
import { useEntryStore } from "../../../store"
import { useT } from "../../../i18n"
import { buttonsRowStyle, buttonStyle } from "../styles/buttons"
import { buttonsInitial, buttonsAnimate, buttonsExit } from "../motion/buttonsVariants"

function handleHoverEnter(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--color-fg)"
  e.currentTarget.style.color = "var(--color-bg)"
}

function handleHoverLeave(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "transparent"
  e.currentTarget.style.color = "var(--color-fg)"
}

// 两按钮：从头开始 / 我已来过
export function EntryButtons() {
  const chooseFirstEntry = useEntryStore((s) => s.chooseFirstEntry)
	const tr = useT()

  function onLinear(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    chooseFirstEntry("linear")
  }

  function onFreeExplore(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    chooseFirstEntry("free_explore")
  }

  return (
    <motion.div
      key="buttons"
      initial={buttonsInitial}
      animate={buttonsAnimate}
      exit={buttonsExit}
      style={buttonsRowStyle}
    >
      <button
        onClick={onLinear}
        style={buttonStyle}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
      >
        {tr.entry.startFromBeginning}
      </button>
      <button
        onClick={onFreeExplore}
        style={buttonStyle}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
      >
        {tr.entry.iveBeenHere}
      </button>
    </motion.div>
  )
}
