import { motion } from "framer-motion"
import { anyKeyStyle } from "../styles/anyKey"
import { anyKeyInitial, anyKeyAnimate, anyKeyExit } from "../motion/anyKeyVariants"
import { t } from "../../../i18n"

// "按任意键开始探索" 闪烁提示
export function AnyKeyHint() {
  return (
    <motion.div
      key="any-key"
      initial={anyKeyInitial}
      animate={anyKeyAnimate}
      exit={anyKeyExit}
      style={anyKeyStyle}
    >
      {t().entry.anyKeyHint}
    </motion.div>
  )
}
