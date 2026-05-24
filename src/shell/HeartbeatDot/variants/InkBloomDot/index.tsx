import { motion } from "framer-motion"
import type { VariantDotProps } from "../../types"
import {
	INK_BLOOM_CORE_STYLE,
	INK_BLOOM_HALO_STYLE,
	INK_BLOOM_WRAPPER_STYLE,
} from "./styles"
import {
	inkBloomCoreVariants,
	inkBloomHaloVariants,
	inkBloomWrapperVariants,
} from "./motion"

export function InkBloomDot({ phase }: VariantDotProps) {
	return (
		<motion.div
			style={INK_BLOOM_WRAPPER_STYLE}
			variants={inkBloomWrapperVariants}
			initial="breathing"
			animate={phase}
		>
			<motion.div
				style={INK_BLOOM_HALO_STYLE}
				variants={inkBloomHaloVariants}
				initial="breathing"
				animate={phase}
			/>
			<motion.div
				style={INK_BLOOM_CORE_STYLE}
				variants={inkBloomCoreVariants}
				initial="breathing"
				animate={phase}
			/>
		</motion.div>
	)
}
