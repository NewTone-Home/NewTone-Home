import { useRef } from "react"
import { defaultAdapter } from "../../content"
import { useLocalized } from "../../i18n/useLocalized"
import { useEntryStore } from "../../store/useEntryStore"
import { FALLBACK_CHAPTER_ID } from "./constants"
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
	const eventContext =
		destination?.kind === "chapter" && destination.eventId
			? getEventContext(destination.eventId)
			: undefined

	const containerRef = useRef<HTMLDivElement>(null)
	const paraRefs = useRef<Array<HTMLDivElement | null>>([])
	const { styles, progress, flares } = useChapterFocus(containerRef, paraRefs, paragraphs)
	useChapterScrollMemory(chapterId, containerRef)

	if (!chapter) return null

	const handleBack = () => {
		if (destination?.kind === "chapter" && destination.returnTo) {
			goTo(destination.returnTo)
			return
		}
		goTo({
			kind: "multiverse",
			worldId: "first-world",
			regionId: "central-ring",
			layerId: "surface",
		})
	}
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
					<ChapterHeader title={tr(chapter.title)} meta={eventContext?.meta} />
					<ChapterBody
						paragraphs={paragraphs}
						styles={styles}
						tr={tr}
						setParagraphRef={setParagraphRef}
					/>
					<ChapterFooter
						onBack={handleBack}
						onRestart={handleRestart}
						backLabel="返回地图"
						hint="后续事件待开放 / 更多事件后续开放"
					/>
				</div>
			</div>
			<ChapterSidebar progress={progress} flares={flares} onBack={handleBack} />
		</>
	)
}

function getEventContext(eventId: string) {
	for (const world of defaultAdapter.getWorlds()) {
		const regions =
			world.regions ??
			(world.layers || world.mapAnchors || world.events
				? [
						{
							id: "default",
							title: world.name,
							layers: world.layers ?? [],
							mapAnchors: world.mapAnchors ?? [],
							events: world.events ?? [],
						},
					]
				: [])

		for (const region of regions) {
			const event = region.events.find((item) => item.id === eventId)
			if (!event) continue

			for (const anchor of region.mapAnchors) {
				const manifestation = Object.values(anchor.manifestations).find(
					(item) => item?.id === event.manifestationId,
				)
				if (!manifestation) continue

				const layer = region.layers.find(
					(item) => item.id === manifestation.layerId,
				)
				if (!layer) continue

				const layerLabel = layer.label.zh ?? layer.label.en ?? layer.id
				const locationTitle =
					manifestation.title.zh ?? manifestation.title.en ?? manifestation.id
				const typeLabel =
					event.type === "main"
						? "主线事件"
						: event.type === "side"
							? "支线事件"
							: "番外事件"

				return {
					meta: [locationTitle, typeLabel, `所属层：${layerLabel}`],
				}
			}
		}
	}

	return undefined
}
