import { motion } from "framer-motion"
import type { VariantDotProps } from "../../types"
import {
	DEEP_SPACE_CORE_STYLE,
	DEEP_SPACE_HALO_STYLE,
	DEEP_SPACE_WRAPPER_STYLE,
} from "./styles"
import {
	deepSpaceCoreVariants,
	deepSpaceHaloVariants,
	deepSpaceWrapperVariants,
} from "./motion"

export function DeepSpaceDot({ phase }: VariantDotProps) {
	return (
		<motion.div
			style={DEEP_SPACE_WRAPPER_STYLE}
			variants={deepSpaceWrapperVariants}
			initial="breathing"
			animate={phase}
		>
			<motion.div
				style={DEEP_SPACE_HALO_STYLE}
				variants={deepSpaceHaloVariants}
				initial="breathing"
				animate={phase}
			/>
			<motion.div
				style={DEEP_SPACE_CORE_STYLE}
				variants={deepSpaceCoreVariants}
				initial="breathing"
				animate={phase}
			/>
		</motion.div>
	)
}
