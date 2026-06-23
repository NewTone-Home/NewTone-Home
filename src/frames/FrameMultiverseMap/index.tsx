import { useCallback } from "react"
import { defaultAdapter } from "../../content"
import { useLocalized } from "../../i18n/useLocalized"
import { useLanguageStore } from "../../store/useLanguageStore"
import { useEntryStore } from "../../store/useEntryStore"
import {
	AVAILABLE_CARD_STYLE,
	CARD_GRID_STYLE,
	CONTAINER_STYLE,
	LOCKED_CARD_STYLE,
	META_STYLE,
	STATUS_STYLE,
	SUBTITLE_STYLE,
	TITLE_STYLE,
	WORLD_ID_STYLE,
	WORLD_NAME_STYLE,
	WORLD_TAGLINE_STYLE,
	WRAP_STYLE,
} from "./styles"

const LOCKED_WORLDS = ["W2", "W3", "W4"]

export function FrameMultiverseMap() {
	const lang = useLanguageStore((s) => s.lang)
	const localize = useLocalized()
	const goTo = useEntryStore((s) => s.goTo)
	const chumo = defaultAdapter.getWorldById("chumo")

	const handleEnterChumo = useCallback(() => {
		goTo({ kind: "world_hall", worldId: "chumo" })
	}, [goTo])

	return (
		<main style={CONTAINER_STYLE}>
			<section style={WRAP_STYLE} aria-labelledby="multiverse-title">
				<header>
					<p style={META_STYLE}>{lang === "en" ? "NewTone" : "NewTone"}</p>
					<h1 id="multiverse-title" style={TITLE_STYLE}>
						{lang === "en" ? "Multiverse" : "多元宇宙"}
					</h1>
					<p style={SUBTITLE_STYLE}>
						{lang === "en" ? "Choose a world." : "选择一个世界。"}
					</p>
				</header>

				<div style={CARD_GRID_STYLE} aria-label="World map">
					{chumo && (
						<button
							type="button"
							style={AVAILABLE_CARD_STYLE}
							onClick={handleEnterChumo}
						>
							<span style={WORLD_ID_STYLE}>W1</span>
							<span style={WORLD_NAME_STYLE}>{localize(chumo.name)}</span>
							{chumo.tagline && (
								<span style={WORLD_TAGLINE_STYLE}>{localize(chumo.tagline)}</span>
							)}
							<span style={STATUS_STYLE}>
								{lang === "en" ? "available" : "available"}
							</span>
						</button>
					)}

					{LOCKED_WORLDS.map((worldId) => (
						<div key={worldId} style={LOCKED_CARD_STYLE} aria-disabled="true">
							<span style={WORLD_ID_STYLE}>{worldId}</span>
							<span style={WORLD_NAME_STYLE}>
								{lang === "en" ? "Locked" : "未开放"}
							</span>
							<span style={WORLD_TAGLINE_STYLE}>
								{lang === "en" ? "Coming soon" : "Coming soon"}
							</span>
						</div>
					))}
				</div>
			</section>
		</main>
	)
}
