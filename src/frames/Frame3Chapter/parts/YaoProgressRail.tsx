import { YAO_LINE_WRAP } from "../styles/sidebar"
import type { FlareEvent } from "../types"
import { lineProgress, yaoLineStyle } from "../utils/progress"
import { YaoSmokeWisps } from "./YaoSmokeWisps"

type YaoProgressRailProps = {
	progress: number
	flares: FlareEvent[]
}

export function YaoProgressRail({ progress, flares }: YaoProgressRailProps) {
	return (
		<>
			{[0, 1, 2].map((index) => {
				const q = lineProgress(progress, index)
				const flare = flares.find((f) => f.lineIndex === index)
				return (
					<div key={index} style={YAO_LINE_WRAP}>
						<div style={yaoLineStyle(q, !!flare)} />
						<YaoSmokeWisps q={q} />
					</div>
				)
			})}
		</>
	)
}
