import type { Variants } from "framer-motion"

// 顶部世界名缓慢入场
export const titleVariants: Variants = {
	hidden: { opacity: 0, y: -4 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
	},
}
