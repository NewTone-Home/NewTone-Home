import { ROMAN } from "../constants"
import {
	FOOTER_ACTION_BUTTON,
	FOOTER_ACTIONS,
	FOOTER_HINT,
	FOOTER_OUTER,
	FOOTER_ROMAN,
} from "../styles/footer"

type ChapterFooterProps = {
	onBack: () => void
	onRestart: () => void
	backLabel?: string
	hint?: string
}

export function ChapterFooter({
	onBack,
	onRestart,
	backLabel = "返回地图",
	hint = "后续事件待开放",
}: ChapterFooterProps) {
	return (
		<div style={FOOTER_OUTER}>
			<div style={FOOTER_ROMAN}>{ROMAN}</div>
			<div style={FOOTER_HINT}>{hint}</div>
			<div style={FOOTER_ACTIONS}>
				<button type="button" style={FOOTER_ACTION_BUTTON} onClick={onBack}>
					{backLabel}
				</button>
				<button type="button" style={FOOTER_ACTION_BUTTON} onClick={onRestart}>
					重读事件
				</button>
			</div>
		</div>
	)
}
