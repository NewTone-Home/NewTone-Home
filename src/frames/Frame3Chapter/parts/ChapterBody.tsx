import type { ChapterParagraph } from "../../../types/chapter"
import { paragraphStyle } from "../styles/paragraph"
import type { ParagraphFocusStyle } from "../types"

type ChapterBodyProps = {
	paragraphs: ChapterParagraph[]
	styles: ParagraphFocusStyle[]
	tr: (text: ChapterParagraph["text"]) => string
	setParagraphRef: (index: number, el: HTMLDivElement | null) => void
}

export function ChapterBody({
	paragraphs,
	styles,
	tr,
	setParagraphRef,
}: ChapterBodyProps) {
	return (
		<>
			{paragraphs.map((paragraph, index) => {
				const focus = styles[index] ?? { o: 1, t: 0 }
				return (
					<div
						key={paragraph.id ?? index}
						ref={(el) => setParagraphRef(index, el)}
						style={paragraphStyle(paragraph.type, focus.o, focus.t)}
					>
						{tr(paragraph.text)}
					</div>
				)
			})}
		</>
	)
}
