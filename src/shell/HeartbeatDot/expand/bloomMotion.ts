import type { Variants } from "framer-motion"
import {
	BLOOM_DURATION_MS,
	COLLAPSE_DURATION_MS,
	STAGGER_MS,
} from "../shared/breathConfig"

const BLOOM_S = BLOOM_DURATION_MS / 1000
const COLLAPSE_S = COLLAPSE_DURATION_MS / 1000
const STAGGER_S = STAGGER_MS / 1000

// 钉 1: 复用 Logo 入场墨痕语言, 反向播放 (Step B 占位:简单 fade-up, Step C 后接真实墨痕 SVG)
// 钉 3: collapsing 用 staggerDirection: -1 反向播放
export const clusterVariants: Variants = {
	hidden: {},
	bloomed: { transition: { staggerChildren: STAGGER_S } },
	collapsing: { transition: { staggerChildren: STAGGER_S, staggerDirection: -1 } },
}

export const iconVariants: Variants = {
	hidden: { opacity: 0, y: 4 },
	bloomed: {
		opacity: 1,
		y: 0,
		transition: { duration: BLOOM_S, ease: "easeOut" },
	},
	collapsing: {
		opacity: 0,
		y: 3,
		transition: { duration: COLLAPSE_S, ease: "easeIn" },
	},
}
