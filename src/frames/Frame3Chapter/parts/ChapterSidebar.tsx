import { ROMAN } from "../constants"
import {
	SIDEBAR,
	SIDEBAR_BACK,
	SIDEBAR_BOTTOM_PAD,
	SIDEBAR_ROMAN,
	SIDEBAR_YAO_BOX,
} from "../styles/sidebar"
import type { FlareEvent } from "../types"
import { YaoProgressRail } from "./YaoProgressRail"

type ChapterSidebarProps = {
	progress: number
	flares: FlareEvent[]
	onBack: () => void
}

export function ChapterSidebar({ progress, flares, onBack }: ChapterSidebarProps) {
	return (
		<div className="chapter-sidebar" style={SIDEBAR}>
			<button
				onClick={onBack}
				style={SIDEBAR_BACK}
				onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
				onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.15")}
				aria-label="back"
			>
				{"\u2190"}
			</button>
			<div style={SIDEBAR_ROMAN}>{ROMAN}</div>
			<div style={SIDEBAR_YAO_BOX}>
				<YaoProgressRail progress={progress} flares={flares} />
			</div>
			<div style={SIDEBAR_BOTTOM_PAD} />
		</div>
	)
}
