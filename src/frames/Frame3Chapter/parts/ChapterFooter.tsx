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
}

export function ChapterFooter({ onBack, onRestart }: ChapterFooterProps) {
	return (
		<div style={FOOTER_OUTER}>
			<div style={FOOTER_ROMAN}>{ROMAN}</div>
			<div style={FOOTER_HINT}>(末页)</div>
			<div style={FOOTER_ACTIONS}>
				<button type="button" style={FOOTER_ACTION_BUTTON} onClick={onBack}>
					回到初墨
				</button>
				<button type="button" style={FOOTER_ACTION_BUTTON} onClick={onRestart}>
					重读本章
				</button>
			</div>
		</div>
	)
}
