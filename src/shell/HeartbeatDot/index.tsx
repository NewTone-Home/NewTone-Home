import { motion } from "framer-motion"
import { heartbeatDotStyle } from "./styles"
import { heartbeatAnimate, heartbeatTransition } from "./motion"

// 全局心跳点配饰（右下角）
// 在所有 frame 之上显示，呼吸感的脉动
export function HeartbeatDot() {
  return (
    <motion.div
      style={heartbeatDotStyle}
      animate={heartbeatAnimate}
      transition={heartbeatTransition}
    />
  )
}
