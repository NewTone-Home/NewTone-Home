import { ROMAN, TRIGRAM } from "../constants"
import {
	HEADER_OUTER,
	HEADER_ROMAN,
	HEADER_RULE_LINE,
	HEADER_RULE_ROW,
	HEADER_RULE_TRIGRAM,
	HEADER_TITLE,
} from "../styles/header"

type ChapterHeaderProps = {
	title: string
	meta?: string[]
}

export function ChapterHeader({ title, meta = [] }: ChapterHeaderProps) {
	return (
		<div style={HEADER_OUTER}>
			<div style={HEADER_ROMAN}>{ROMAN}</div>
			<div style={HEADER_TITLE}>{title}</div>
			{meta.length > 0 && (
				<div
					style={{
						marginTop: 10,
						fontSize: 12,
						fontWeight: 300,
						letterSpacing: 0,
						opacity: 0.56,
					}}
				>
					{meta.join(" / ")}
				</div>
			)}
			<div style={HEADER_RULE_ROW}>
				<span style={HEADER_RULE_LINE} />
				<span style={HEADER_RULE_TRIGRAM}>{TRIGRAM}</span>
				<span style={HEADER_RULE_LINE} />
			</div>
		</div>
	)
}
