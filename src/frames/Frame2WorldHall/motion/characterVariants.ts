import type { Variants } from "framer-motion"

// 默认 18% 极淡存在感,hover 时缓慢实体化
export const DORMANT_OPACITY = 0.18
export const ACTIVE_OPACITY = 1
export const ACTIVE_SCALE = 1.04

export const characterVariants: Variants = {
	dormant: {
		opacity: DORMANT_OPACITY,
		scale: 1,
		transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
	},
	active: {
		opacity: ACTIVE_OPACITY,
		scale: ACTIVE_SCALE,
		transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
	},
}
