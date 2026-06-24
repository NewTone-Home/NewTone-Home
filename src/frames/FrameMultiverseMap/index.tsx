import { useCallback, useEffect } from "react"
import { defaultAdapter } from "../../content"
import { useLocalized } from "../../i18n/useLocalized"
import { useLanguageStore } from "../../store/useLanguageStore"
import { useEntryStore } from "../../store/useEntryStore"
import {
	ARRIVAL_BODY_STYLE,
	ARRIVAL_GUIDE_STYLE,
	ARRIVAL_KICKER_STYLE,
	ARRIVAL_TITLE_STYLE,
	BACKGROUND_STYLE,
	BOARD_ACTION_STYLE,
	BOARD_META_STYLE,
	CHUMO_CODE_STYLE,
	CONTAINER_STYLE,
	INACTIVE_LINE_DEPTH_STYLE,
	INACTIVE_LINE_LABEL_STYLE,
	INACTIVE_LINE_NUMBER_STYLE,
	INACTIVE_LINE_STYLE,
	INACTIVE_LINES_STYLE,
	PLATFORM_NAME_STYLE,
	PLATFORM_SIGN_STYLE,
	PLATFORM_STATUS_STYLE,
	PLATFORM_WRAP_STYLE,
	SCENE_OVERLAY_STYLE,
	SCREEN_VEIL_STYLE,
	SIGN_LABEL_STYLE,
} from "./styles"

const INACTIVE_LINES = [
	{ id: "02", depth: "far" },
	{ id: "03", depth: "mid" },
	{ id: "04", depth: "near" },
] as const

export function FrameMultiverseMap() {
	const lang = useLanguageStore((s) => s.lang)
	const localize = useLocalized()
	const goTo = useEntryStore((s) => s.goTo)
	const chumo = defaultAdapter.getWorldById("chumo")
	const chumoName = chumo ? localize(chumo.name) : "初墨"

	const handleBoardChumo = useCallback(() => {
		goTo({ kind: "world_hall", worldId: "chumo" })
	}, [goTo])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			const tagName = target?.tagName.toLowerCase()
			const isEditable =
				tagName === "input" ||
				tagName === "textarea" ||
				tagName === "select" ||
				target?.isContentEditable

			if (event.defaultPrevented || event.isComposing || isEditable) return
			if (event.key !== "Enter" && event.key.toLowerCase() !== "e") return

			event.preventDefault()
			handleBoardChumo()
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleBoardChumo])

	return (
		<main style={CONTAINER_STYLE}>
			<div style={BACKGROUND_STYLE} aria-hidden="true" />
			<div style={SCREEN_VEIL_STYLE} aria-hidden="true" />

			<section style={SCENE_OVERLAY_STYLE} aria-labelledby="multiverse-title">
				<aside style={ARRIVAL_GUIDE_STYLE}>
					<p style={ARRIVAL_KICKER_STYLE}>
						{lang === "en" ? "NEWTONE TRANSIT" : "NEWTONE TRANSIT"}
					</p>
					<h1 id="multiverse-title" style={ARRIVAL_TITLE_STYLE}>
						{lang === "en" ? "Multiverse Transit" : "多元宇宙枢纽"}
					</h1>
					<p style={ARRIVAL_BODY_STYLE}>
						{lang === "en"
							? "A quiet transfer station between worlds."
							: "世界之间的安静换乘站。"}
					</p>
					<p style={ARRIVAL_BODY_STYLE}>
						{lang === "en"
							? "From here, depart for the worlds ahead."
							: "从这里，前往诸世界。"}
					</p>
				</aside>

				<div style={PLATFORM_WRAP_STYLE}>
					<button
						type="button"
						style={PLATFORM_SIGN_STYLE}
						onClick={handleBoardChumo}
					>
						<span style={SIGN_LABEL_STYLE}>PLATFORM 01</span>
						<span style={PLATFORM_NAME_STYLE}>{chumoName}</span>
						<span style={CHUMO_CODE_STYLE}>CHUMO</span>
						<span style={BOARD_META_STYLE}>
							{lang === "en" ? "Boarding available" : "当前线路 · 可登车"}
						</span>
						<span style={BOARD_ACTION_STYLE}>
							{lang === "en" ? "[E] Board" : "[E] 登车 / 前往世界"}
						</span>
						<span style={PLATFORM_STATUS_STYLE} aria-hidden="true" />
					</button>
				</div>

				<div style={INACTIVE_LINES_STYLE} aria-label="Inactive transit lines">
					{INACTIVE_LINES.map((line) => (
						<div
							key={line.id}
							style={{
								...INACTIVE_LINE_STYLE,
								...INACTIVE_LINE_DEPTH_STYLE[line.depth],
							}}
							aria-disabled="true"
						>
							<span style={INACTIVE_LINE_NUMBER_STYLE}>{line.id}</span>
							<span style={INACTIVE_LINE_LABEL_STYLE}>
								{lang === "en" ? "Line closed" : "未开放"}
							</span>
						</div>
					))}
				</div>
			</section>
		</main>
	)
}
