import { useCallback, useEffect, useRef, useState } from "react"
import type { HoverPhase } from "./types"
import {
	ENTER_DELAY_MS,
	IGNITE_DURATION_MS,
	EXIT_GRACE_MS,
	COLLAPSE_DURATION_MS,
} from "./shared/breathConfig"

/**
 * Hover 展开状态机（Canon §13.3）
 * mouseEnter → 80ms 防误触 → igniting (120ms) → bloomed
 * mouseLeave → 300ms 宽容期 → collapsing (320ms) → breathing
 * 宽容期内 mouseEnter 回来 → 取消 collapse, 直接回 bloomed
 * disabled=true → 永远停在 breathing（钉 11 过场版不可交互）
 */
export function useHoverExpand(disabled: boolean) {
	const [phase, setPhase] = useState<HoverPhase>("breathing")
	const enterTimer = useRef<number | null>(null)
	const igniteTimer = useRef<number | null>(null)
	const graceTimer = useRef<number | null>(null)
	const collapseTimer = useRef<number | null>(null)

	const clearAll = useCallback(() => {
		if (enterTimer.current) window.clearTimeout(enterTimer.current)
		if (igniteTimer.current) window.clearTimeout(igniteTimer.current)
		if (graceTimer.current) window.clearTimeout(graceTimer.current)
		if (collapseTimer.current) window.clearTimeout(collapseTimer.current)
		enterTimer.current = null
		igniteTimer.current = null
		graceTimer.current = null
		collapseTimer.current = null
	}, [])

	const onMouseEnter = useCallback(() => {
		if (disabled) return
		// 宽容期内回来 → 取消 collapse, 直接回 bloomed
		if (graceTimer.current) {
			window.clearTimeout(graceTimer.current)
			graceTimer.current = null
			setPhase("bloomed")
			return
		}
		// 正在收回 → 直接回 bloomed
		if (collapseTimer.current) {
			window.clearTimeout(collapseTimer.current)
			collapseTimer.current = null
			setPhase("bloomed")
			return
		}
		// 已经在等 80ms 或已展开 → 不重复触发
		if (enterTimer.current) return
		if (phase !== "breathing") return
		enterTimer.current = window.setTimeout(() => {
			enterTimer.current = null
			setPhase("igniting")
			igniteTimer.current = window.setTimeout(() => {
				igniteTimer.current = null
				setPhase("bloomed")
			}, IGNITE_DURATION_MS)
		}, ENTER_DELAY_MS)
	}, [disabled, phase])

	const onMouseLeave = useCallback(() => {
		if (disabled) return
		// 80ms 防误触期间离开 → 取消,不触发
		if (enterTimer.current) {
			window.clearTimeout(enterTimer.current)
			enterTimer.current = null
			return
		}
		// 进入 300ms 宽容期 → collapsing
		if (phase === "bloomed" || phase === "igniting") {
			graceTimer.current = window.setTimeout(() => {
				graceTimer.current = null
				setPhase("collapsing")
				collapseTimer.current = window.setTimeout(() => {
					collapseTimer.current = null
					setPhase("breathing")
				}, COLLAPSE_DURATION_MS)
			}, EXIT_GRACE_MS)
		}
	}, [disabled, phase])

	useEffect(() => clearAll, [clearAll])
	useEffect(() => {
		if (disabled) {
			clearAll()
			setPhase("breathing")
		}
	}, [disabled, clearAll])

	return { phase, onMouseEnter, onMouseLeave }
}
