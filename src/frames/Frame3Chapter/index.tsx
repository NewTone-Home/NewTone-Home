import { useRef } from "react"
import { defaultAdapter } from "../../content"
import { useLocalized } from "../../i18n/useLocalized"
import { useEntryStore } from "../../store/useEntryStore"
import { FALLBACK_CHAPTER_ID, FALLBACK_WORLD_ID } from "./constants"
import { useChapterFocus } from "./hooks/useChapterFocus"
import { useChapterScrollMemory } from "./hooks/useChapterScrollMemory"
import { ChapterBody } from "./parts/ChapterBody"
import { ChapterFooter } from "./parts/ChapterFooter"
import { ChapterHeader } from "./parts/ChapterHeader"
import { ChapterSidebar } from "./parts/ChapterSidebar"
import { CONTAINER, SPACE } from "./styles/container"
import type { Frame3ChapterProps } from "./types"

export function Frame3Chapter({ chapterId: propChapterId }: Frame3ChapterProps) {
	const destination = useEntryStore((s) => s.destination)
	const goTo = useEntryStore((s) => s.goTo)
	const tr = useLocalized()

	const chapterId =
		propChapterId ??
		(destination?.kind === "chapter" ? destination.chapterId : FALLBACK_CHAPTER_ID)
	const chapter = defaultAdapter.getChapterById(chapterId)
	const paragraphs = chapter?.paragraphs ?? []

	const containerRef = useRef<HTMLDivElement>(null)
	const paraRefs = useRef<Array<HTMLDivElement | null>>([])
	const { styles, progress, flares } = useChapterFocus(containerRef, paraRefs, paragraphs)
	useChapterScrollMemory(chapterId, containerRef)

	if (!chapter) return null

	const handleBack = () => goTo({ kind: "world_hall", worldId: FALLBACK_WORLD_ID })
	const handleRestart = () => {
		const el = containerRef.current
		if (!el) return
		el.scrollTo({ top: 0, behavior: "smooth" })
	}
	const mobileProgressFillStyle = {
		transform: "scaleX(" + progress + ")",
	}
	const setParagraphRef = (index: number, el: HTMLDivElement | null) => {
		paraRefs.current[index] = el
	}

	return (
		<>
			<div className="chapter-mobile-progress" aria-hidden="true">
				<div
					className="chapter-mobile-progress-fill"
					style={mobileProgressFillStyle}
				/>
			</div>
			<div ref={containerRef} style={CONTAINER} className="scroll-invisible">
				<div style={SPACE}>
					<ChapterHeader title={tr(chapter.title)} />
					<ChapterBody
						paragraphs={paragraphs}
						styles={styles}
						tr={tr}
						setParagraphRef={setParagraphRef}
					/>
					<ChapterFooter onBack={handleBack} onRestart={handleRestart} />
				</div>
			</div>
			<ChapterSidebar progress={progress} flares={flares} onBack={handleBack} />
		</>
	)
}
