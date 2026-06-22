import { useLanguageStore } from "../../../store/useLanguageStore"
import {
	CHAPTER_BUTTON_STYLE,
	CHAPTER_LIST_LABEL_STYLE,
	CHAPTER_LIST_STYLE,
	CHAPTER_LIST_WRAP_STYLE,
	CHAPTER_ORDER_STYLE,
	CHAPTER_TITLE_STYLE,
} from "../styles/chapterList"
import { pickText } from "../utils/pick"
import type { Chapter } from "../../../types"

type Props = {
	chapters: Chapter[]
	onSelect: (chapterId: string) => void
}

export function ChapterList({ chapters, onSelect }: Props) {
	const lang = useLanguageStore((s) => s.lang)

	if (!chapters.length) return null

	return (
		<nav style={CHAPTER_LIST_WRAP_STYLE} aria-label="Chapter list">
			<p style={CHAPTER_LIST_LABEL_STYLE}>
				{lang === "en" ? "Chapters" : "Chapters"}
			</p>
			<ol style={CHAPTER_LIST_STYLE}>
				{chapters.map((chapter) => (
					<li key={chapter.id}>
						<button
							type="button"
							style={CHAPTER_BUTTON_STYLE}
							onClick={() => onSelect(chapter.id)}
						>
							<span style={CHAPTER_ORDER_STYLE}>
								{lang === "en" ? `Ch.${chapter.order}` : `Ch.${chapter.order}`}
							</span>
							<span style={CHAPTER_TITLE_STYLE}>
								{pickText(chapter.title, lang)}
							</span>
						</button>
					</li>
				))}
			</ol>
		</nav>
	)
}
