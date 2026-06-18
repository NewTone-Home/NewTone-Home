import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import type { ChapterParagraph } from "../../../types/chapter"
import {
	FLARE_DURATION_MS,
	FOCUS_RANGE,
	MAX_TRANSLATE,
	MIN_OPACITY,
} from "../constants"
import { DRAMATIC_TYPES } from "../styles/paragraph"
import type { FlareEvent, ParagraphFocusStyle } from "../types"

export function useChapterFocus(
	containerRef: RefObject<HTMLDivElement | null>,
	paraRefs: RefObject<Array<HTMLDivElement | null>>,
	paragraphs: ChapterParagraph[],
) {
	const focusedIdxRef = useRef<number>(-1)
	const lastFireIdRef = useRef<string | null>(null)
	const timeoutsRef = useRef<number[]>([])
	const [styles, setStyles] = useState<ParagraphFocusStyle[]>([])
	const [progress, setProgress] = useState(0)
	const [flares, setFlares] = useState<FlareEvent[]>([])

	useEffect(() => {
		let raf = 0

		const maybeFireFlare = (focusedIdx: number, items: ChapterParagraph[]) => {
			if (focusedIdx < 0 || focusedIdx === focusedIdxRef.current) return
			focusedIdxRef.current = focusedIdx
			const para = items[focusedIdx]
			if (!para || DRAMATIC_TYPES.indexOf(para.type) < 0) return
			const pid = para.id ?? String(focusedIdx)
			if (pid === lastFireIdRef.current) return
			lastFireIdRef.current = pid
			const rel = focusedIdx / Math.max(1, items.length - 1)
			const lineIndex = rel < 0.33 ? 0 : rel < 0.66 ? 1 : 2
			const key = Date.now()
			setFlares((prev) => prev.filter((f) => f.lineIndex !== lineIndex).concat({ lineIndex, key }))
			timeoutsRef.current.push(window.setTimeout(() => {
				setFlares((prev) => prev.filter((f) => f.key !== key))
			}, FLARE_DURATION_MS))
		}

		const updateFromScroll = (el: HTMLDivElement) => {
			const vc = window.innerHeight / 2
			let maxO = 0
			let focusedIdx = -1
			const next = paraRefs.current.map((node, index) => {
				if (!node) return { o: MIN_OPACITY, t: 0 }
				const r = node.getBoundingClientRect()
				const pc = r.top + r.height / 2
				const k = Math.min(1, Math.abs(pc - vc) / (window.innerHeight * FOCUS_RANGE))
				const o = MIN_OPACITY + (1 - MIN_OPACITY) * (1 - k * k)
				const t = (pc < vc ? -1 : 1) * MAX_TRANSLATE * (1 - o)
				if (o > maxO) { maxO = o; focusedIdx = index }
				return { o, t }
			})
			setStyles(next)
			const max = el.scrollHeight - el.clientHeight
			setProgress(max > 0 ? el.scrollTop / max : 0)
			maybeFireFlare(focusedIdx, paragraphs)
		}

		const tick = () => {
			const el = containerRef.current
			if (el) updateFromScroll(el)
			raf = requestAnimationFrame(tick)
		}

		raf = requestAnimationFrame(tick)
		return () => {
			cancelAnimationFrame(raf)
			timeoutsRef.current.forEach((id) => window.clearTimeout(id))
			timeoutsRef.current = []
		}
	}, [containerRef, paraRefs, paragraphs])

	return { styles, progress, flares }
}
