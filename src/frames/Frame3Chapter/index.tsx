import { useEffect, useRef, useState, CSSProperties } from "react"
import { defaultAdapter } from "../../content"
import type { ChapterParagraph } from "../../types/chapter"
import { useEntryStore } from "../../store/useEntryStore"
import { useLocalized } from "../../i18n/useLocalized"

const FOCUS_RANGE = 0.55
const MIN_OPACITY = 0.04
const MAX_TRANSLATE = 24
const TRIGRAM = "☰"
const ROMAN = "I"
const CHAR_COLOR = "var(--char-color-qian)"
const FALLBACK_CHAPTER_ID = "chumo-arc1-ch3"
const FALLBACK_WORLD_ID = "chumo"
const FLARE_DURATION_MS = 600
const PUFF_SWAYS_PX = [-8, 5, -4, 7, -3]
const PUFF_DELAYS_MS = [0, 280, 560, 840, 1120]

type ParaType = ChapterParagraph["type"]

const PARA_OPEN: CSSProperties = { fontSize: 26, marginBottom: "28vh", textAlign: "center" }
const PARA_NARRATE: CSSProperties = { fontSize: 18, marginBottom: "1.5em" }
const PARA_KEY: CSSProperties = { fontSize: 22, marginBottom: "22vh", fontStyle: "italic" }
const PARA_THOUGHT: CSSProperties = { fontSize: 18, marginBottom: "14vh", color: "var(--color-muted)" }
const PARA_DIALOGUE: CSSProperties = { fontSize: 22, marginBottom: "14vh" }
const PARA_PAUSE: CSSProperties = { fontSize: 22, marginBottom: "25vh", textAlign: "center", color: "var(--color-muted)" }

const DRAMATIC_TYPES: Array<ParaType> = ["open", "key", "pause"]

function paraBase(type: ParaType): CSSProperties {
	if (type === "open") return PARA_OPEN
	if (type === "narrate") return PARA_NARRATE
	if (type === "key") return PARA_KEY
	if (type === "thought") return PARA_THOUGHT
	if (type === "dialogue") return PARA_DIALOGUE
	return PARA_PAUSE
}

function paraStyle(type: ParaType, o: number, t: number): CSSProperties {
	return Object.assign({}, paraBase(type), {
		opacity: o,
		transform: "translateY(" + t + "px)",
		transition: "opacity 120ms linear, transform 120ms linear",
	})
}

const CONTAINER: CSSProperties = { position: "fixed", inset: 0, overflowY: "auto", background: "var(--color-bg)", color: "var(--color-fg)" }
const SPACE: CSSProperties = { maxWidth: 580, margin: "0 auto", padding: "40vh 24px 25vh", fontFamily: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif', lineHeight: 1.85 }
const SIDEBAR: CSSProperties = { position: "fixed", top: 0, left: 0, bottom: 0, width: 60, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 32, paddingBottom: 32, zIndex: 10, pointerEvents: "none" }

const HEADER_OUTER: CSSProperties = { textAlign: "center", marginBottom: "18vh", opacity: 0.85 }
const HEADER_ROMAN: CSSProperties = { fontSize: 14, letterSpacing: "0.4em", opacity: 0.4, marginBottom: 24 }
const HEADER_TITLE: CSSProperties = { fontSize: 32, letterSpacing: "0.15em", fontWeight: 400, marginBottom: 28 }
const HEADER_RULE_ROW: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 12, opacity: 0.4 }
const HEADER_RULE_LINE: CSSProperties = { display: "inline-block", width: 40, height: 1, background: "currentColor" }
const HEADER_RULE_TRIGRAM: CSSProperties = { fontSize: 18 }

const FOOTER_OUTER: CSSProperties = { textAlign: "center", marginTop: "20vh", opacity: 0.85 }
const FOOTER_ROMAN: CSSProperties = { fontSize: 12, opacity: 0.4, letterSpacing: "0.3em", marginBottom: 12 }
const FOOTER_HINT: CSSProperties = { fontSize: 12, opacity: 0.3 }

function footerHexagram(lit: number): CSSProperties {
	return {
		fontSize: 64,
		color: CHAR_COLOR,
		opacity: lit >= 3 ? 0.7 : 0.15,
		transition: "opacity 1.4s ease-out",
		marginBottom: 16,
	}
}

const SIDEBAR_BACK: CSSProperties = { background: "none", border: "none", color: "var(--color-fg)", fontSize: 22, cursor: "pointer", opacity: 0.15, transition: "opacity 200ms", pointerEvents: "auto", padding: 0 }
const SIDEBAR_ROMAN: CSSProperties = { marginTop: 96, fontSize: 14, letterSpacing: "0.5em", color: "var(--color-fg)", opacity: 0.2 }
const SIDEBAR_YAO_BOX: CSSProperties = { marginTop: "auto", marginBottom: "auto", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }
const SIDEBAR_BOTTOM_PAD: CSSProperties = { marginBottom: 16 }
const YAO_LINE_WRAP: CSSProperties = { position: "relative", width: 24, height: 2, overflow: "visible" }

function lineProgress(progress: number, i: number): number {
	const start = i / 3
	const end = (i + 1) / 3
	return Math.max(0, Math.min(1, (progress - start) / (end - start)))
}

function yaoLineStyle(q: number, flaring: boolean): CSSProperties {
	const opacity = 0.15 + q * 0.5
	const blur = flaring ? 16 : q * 6
	const alpha = flaring ? 1 : q * 0.5
	const glow = "color-mix(in srgb, " + CHAR_COLOR + " " + Math.round(alpha * 100) + "%, transparent)"
	return {
		width: 24,
		height: 2,
		background: q > 0.01 ? CHAR_COLOR : "var(--color-fg)",
		opacity,
		boxShadow: blur > 0 ? "0 0 " + blur + "px " + glow : "none",
		transition: flaring
			? "opacity 200ms ease-out, box-shadow 200ms ease-out"
			: "opacity 600ms ease-out, background 600ms, box-shadow 400ms ease-out",
		position: "relative",
		transformOrigin: "left center",
	}
}

// 加湿器持续雾：横一旦点亮 (q > 0) 就持续向上冒 · 3 颗错开 0/470/940ms · cycle 1400ms 永不停
function puffStyle(idx: number): CSSProperties {
	return {
		animationDelay: PUFF_DELAYS_MS[idx] + "ms",
		"--puff-sway": PUFF_SWAYS_PX[idx] + "px",
	} as CSSProperties
}

function puffsContainerStyle(q: number): CSSProperties {
	return {
		position: "absolute",
		inset: 0,
		opacity: q,
		transition: "opacity 800ms ease-out",
		pointerEvents: "none",
	}
}

function YaoHumidifierPuffs({ q }: { q: number }) {
	return (
		<div style={puffsContainerStyle(q)}>
			{PUFF_DELAYS_MS.map((_, i) => (
				<div key={i} className="yao-humidifier-puff" style={puffStyle(i)} />
			))}
		</div>
	)
}

type FlareEvent = { lineIndex: number; key: number }

export function Frame3Chapter() {
	const destination = useEntryStore((s) => s.destination)
	const goTo = useEntryStore((s) => s.goTo)
	const tr = useLocalized()

	const chapterId = destination?.kind === "chapter" ? destination.chapterId : FALLBACK_CHAPTER_ID
	const chapter = defaultAdapter.getChapterById(chapterId, "zh")
	const paragraphs = chapter?.paragraphs ?? []

	const containerRef = useRef<HTMLDivElement>(null)
	const paraRefs = useRef<Array<HTMLDivElement | null>>([])
	const focusedIdxRef = useRef<number>(-1)
	const lastFireIdRef = useRef<string | null>(null)
	const [styles, setStyles] = useState<Array<{ o: number; t: number }>>([])
	const [progress, setProgress] = useState(0)
	const [flares, setFlares] = useState<Array<FlareEvent>>([])

	useEffect(() => {
		let raf = 0
		const tick = () => {
			const el = containerRef.current
			if (el) {
				const vc = window.innerHeight / 2
				let maxO = 0
				let focusedIdx = -1
				const next = paraRefs.current.map((n, i) => {
					if (!n) return { o: MIN_OPACITY, t: 0 }
					const r = n.getBoundingClientRect()
					const pc = r.top + r.height / 2
					const d = Math.abs(pc - vc)
					const k = Math.min(1, d / (window.innerHeight * FOCUS_RANGE))
					const o = MIN_OPACITY + (1 - MIN_OPACITY) * (1 - k * k)
					const t = (pc < vc ? -1 : 1) * MAX_TRANSLATE * (1 - o)
					if (o > maxO) { maxO = o; focusedIdx = i }
					return { o, t }
				})
				setStyles(next)
				const max = el.scrollHeight - el.clientHeight
				const p = max > 0 ? el.scrollTop / max : 0
				setProgress(p)

				if (focusedIdx >= 0 && focusedIdx !== focusedIdxRef.current) {
					focusedIdxRef.current = focusedIdx
					const para = paragraphs[focusedIdx]
					if (para && DRAMATIC_TYPES.indexOf(para.type) >= 0) {
						const pid = para.id ?? String(focusedIdx)
						if (pid !== lastFireIdRef.current) {
							lastFireIdRef.current = pid
							const rel = focusedIdx / Math.max(1, paragraphs.length - 1)
							const lineIndex = rel < 0.33 ? 0 : rel < 0.66 ? 1 : 2
							const key = Date.now()
							setFlares((prev) => prev.filter((f) => f.lineIndex !== lineIndex).concat({ lineIndex, key }))
							setTimeout(() => {
								setFlares((prev) => prev.filter((f) => f.key !== key))
							}, FLARE_DURATION_MS)
						}
					}
				}
			}
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [paragraphs.length])

	if (!chapter) return null

	const handleBack = () => goTo({ kind: "world_hall", worldId: FALLBACK_WORLD_ID })

	return (
		<>
			<div ref={containerRef} style={CONTAINER} className="scroll-invisible">
				<div style={SPACE}>
					<div style={HEADER_OUTER}>
						<div style={HEADER_ROMAN}>{ROMAN}</div>
						<div style={HEADER_TITLE}>{tr(chapter.title)}</div>
						<div style={HEADER_RULE_ROW}>
							<span style={HEADER_RULE_LINE} />
							<span style={HEADER_RULE_TRIGRAM}>{TRIGRAM}</span>
							<span style={HEADER_RULE_LINE} />
						</div>
					</div>
					{paragraphs.map((p, i) => {
						const s = styles[i] ?? { o: 1, t: 0 }
						const setRef = (el: HTMLDivElement | null) => { paraRefs.current[i] = el }
						return (
							<div key={p.id ?? i} ref={setRef} style={paraStyle(p.type, s.o, s.t)}>{tr(p.text)}</div>
						)
					})}
					<div style={FOOTER_OUTER}>
						<div style={FOOTER_ROMAN}>{ROMAN}</div>
						<div style={FOOTER_HINT}>(未完)</div>
					</div>
				</div>
			</div>

			<div style={SIDEBAR}>
				<button
					onClick={handleBack}
					style={SIDEBAR_BACK}
					onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
					onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.15")}
					aria-label="back"
				>←</button>
				<div style={SIDEBAR_ROMAN}>{ROMAN}</div>
				<div style={SIDEBAR_YAO_BOX}>
					{[0, 1, 2].map((i) => {
						const q = lineProgress(progress, i)
						const flare = flares.find((f) => f.lineIndex === i)
						return (
							<div key={i} style={YAO_LINE_WRAP}>
								<div style={yaoLineStyle(q, !!flare)} />
								<YaoHumidifierPuffs q={q} />
							</div>
						)
					})}
				</div>
				<div style={SIDEBAR_BOTTOM_PAD} />
			</div>
		</>
	)
}
