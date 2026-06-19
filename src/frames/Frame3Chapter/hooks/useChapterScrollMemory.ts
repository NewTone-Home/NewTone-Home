import { useEffect } from "react"
import type { RefObject } from "react"
import { readStorage, writeStorage } from "../../../lib/storage"

const SAVE_DELAY_MS = 180

export function useChapterScrollMemory(
	chapterId: string,
	containerRef: RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		const el = containerRef.current
		if (!el) return

		const saveNow = () => {
			const max = el.scrollHeight - el.clientHeight
			const progress = max > 0 ? el.scrollTop / max : 0
			const current = readStorage()
			writeStorage({
				...current,
				deepestLayer: "chapter",
				lastChapterId: chapterId,
				chapterProgress: {
					...(current.chapterProgress ?? {}),
					[chapterId]: {
						chapterId,
						scrollTop: el.scrollTop,
						progress,
						updatedAt: new Date().toISOString(),
					},
				},
			})
		}

		const stored = readStorage().chapterProgress?.[chapterId]
		if (stored) {
			requestAnimationFrame(() => {
				el.scrollTop = stored.scrollTop
			})
		}

		let timer = 0
		const save = () => {
			window.clearTimeout(timer)
			timer = window.setTimeout(saveNow, SAVE_DELAY_MS)
		}

		el.addEventListener("scroll", save, { passive: true })
		return () => {
			window.clearTimeout(timer)
			el.removeEventListener("scroll", save)
			saveNow()
		}
	}, [chapterId, containerRef])
}
