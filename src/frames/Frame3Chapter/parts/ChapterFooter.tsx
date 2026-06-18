import { ROMAN } from "../constants"
import { FOOTER_HINT, FOOTER_OUTER, FOOTER_ROMAN } from "../styles/footer"

export function ChapterFooter() {
	return (
		<div style={FOOTER_OUTER}>
			<div style={FOOTER_ROMAN}>{ROMAN}</div>
			<div style={FOOTER_HINT}>(未完)</div>
		</div>
	)
}
