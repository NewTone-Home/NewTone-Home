import type { Variants } from "framer-motion"
import {
	BREATH_CORE,
	BREATH_HALO,
	BREATH_PERIOD_S,
	IGNITE_DURATION_MS,
	IGNITE_PEAK_OPACITY,
	IGNITE_CORE_PEAK_OPACITY,
	IGNITE_PEAK_SCALE,
	COLLAPSE_DURATION_MS,
} from "../../shared/breathConfig"

const IGNITE_S = IGNITE_DURATION_MS / 1000
const COLLAPSE_S = COLLAPSE_DURATION_MS / 1000

const breathTransition = {
	duration: BREATH_PERIOD_S,
	ease: "easeInOut" as const,
	repeat: Infinity,
}

export const deepSpaceWrapperVariants: Variants = {
	breathing: { scale: 1, transition: { duration: 0.2 } },
	igniting: {
		scale: IGNITE_PEAK_SCALE,
		transition: { duration: IGNITE_S, ease: "easeOut" },
	},
	bloomed: { scale: IGNITE_PEAK_SCALE, transition: { duration: 0.05 } },
	collapsing: {
		scale: 1,
		transition: { duration: COLLAPSE_S, ease: "easeIn" },
	},
}

export const deepSpaceCoreVariants: Variants = {
	breathing: {
		opacity: [BREATH_CORE.min, BREATH_CORE.max, BREATH_CORE.min],
		transition: breathTransition,
	},
	igniting: {
		opacity: IGNITE_CORE_PEAK_OPACITY,
		transition: { duration: IGNITE_S, ease: "easeOut" },
	},
	bloomed: { opacity: 0, transition: { duration: 0.05 } },
	collapsing: {
		opacity: [BREATH_CORE.min, BREATH_CORE.max, BREATH_CORE.min],
		transition: breathTransition,
	},
}

export const deepSpaceHaloVariants: Variants = {
	breathing: {
		opacity: [BREATH_HALO.min, BREATH_HALO.max, BREATH_HALO.min],
		transition: breathTransition,
	},
	igniting: {
		opacity: IGNITE_PEAK_OPACITY,
		transition: { duration: IGNITE_S, ease: "easeOut" },
	},
	bloomed: { opacity: 0, transition: { duration: 0.05 } },
	collapsing: {
		opacity: [BREATH_HALO.min, BREATH_HALO.max, BREATH_HALO.min],
		transition: breathTransition,
	},
}
