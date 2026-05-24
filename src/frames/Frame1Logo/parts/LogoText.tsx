import { motion } from "framer-motion"
import { logoStyle } from "../styles/logo"
import { logoInitial, logoAnimate, logoTransition } from "../motion/logoVariants"

// NewTone 标题文字
export function LogoText() {
  return (
    <motion.div
      initial={logoInitial}
      animate={logoAnimate}
      transition={logoTransition}
      style={logoStyle}
    >
      NewTone
    </motion.div>
  )
}
