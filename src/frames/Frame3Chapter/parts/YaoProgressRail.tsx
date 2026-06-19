import { YAO_LINE_WRAP } from "../styles/sidebar"
import type { FlareEvent } from "../types"
import { lineProgress, yaoLineFillStyle, yaoLineTrackStyle } from "../utils/progress"
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
						<div style={yaoLineTrackStyle()}>
							<div style={yaoLineFillStyle(q, !!flare)} />
						</div>
						<YaoSmokeWisps q={q} />
					</div>
				)
			})}
		</>
	)
}
