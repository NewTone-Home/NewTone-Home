import { useMemo } from "react"
import { defaultAdapter } from "../../../content"
import { readStorage } from "../../../lib/storage"
import { useLanguageStore } from "../../../store/useLanguageStore"
import { pickText } from "../utils/pick"
import {
	CONTINUE_BUTTON_STYLE,
	CONTINUE_CHAPTER_STYLE,
	CONTINUE_LABEL_STYLE,
} from "../styles/continue"

type Props = {
	onContinue: (chapterId: string) => void
}

export function ContinueReading({ onContinue }: Props) {
	const lang = useLanguageStore((s) => s.lang)
	const chapterId = useMemo(() => readStorage().lastChapterId, [])
	const chapter = useMemo(
		() => (chapterId ? defaultAdapter.getChapterById(chapterId) : undefined),
		[chapterId],
	)

	if (!chapterId) return null

	const chapterLabel = chapter
		? lang === "en"
			? `Chapter ${chapter.order}`
			: `第 ${chapter.order} 章`
		: lang === "en"
			? "Last chapter"
			: "上次章节"
	const title = chapter ? pickText(chapter.title, lang) : undefined

	return (
		<button
			type="button"
			style={CONTINUE_BUTTON_STYLE}
			onClick={() => onContinue(chapterId)}
		>
			<span style={CONTINUE_LABEL_STYLE}>
				{lang === "en" ? "Continue reading" : "续看上次章节"}
			</span>
			<span style={CONTINUE_CHAPTER_STYLE}>
				{title ? `${chapterLabel} · ${title}` : chapterLabel}
			</span>
		</button>
	)
}
