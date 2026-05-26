import type { Variants } from "framer-motion"

// 副信息容器：控制子项 stagger
export const metaContainerVariants: Variants = {
	dormant: {
		transition: { staggerChildren: 0.04, staggerDirection: -1 },
	},
	active: {
		transition: { staggerChildren: 0.08, delayChildren: 0.18 },
	},
}

// 单个副信息项（名 + 标签）
export const metaItemVariants: Variants = {
	dormant: {
		opacity: 0,
		y: 4,
		transition: { duration: 0.2 },
	},
	active: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
	},
}
