import { useCallback, useEffect, useRef, useState } from "react"
import { useEntryStore } from "../../store/useEntryStore"
import { useLanguageStore } from "../../store/useLanguageStore"
import type { Lang } from "../../store/useLanguageStore"
import { useThemeStore } from "../../store/useThemeStore"
import type { Theme } from "../../store/useThemeStore"
import {
	ACTION_BUTTON_ACTIVE_STYLE,
	ACTION_BUTTON_STYLE,
	ACTION_LABEL_STYLE,
	ACTION_ROW_STYLE,
	ACTION_VALUE_STYLE,
	DOT_BUTTON_ACTIVE_STYLE,
	DOT_BUTTON_STYLE,
	DOT_BUTTON_DISABLED_STYLE,
	PANEL_STYLE,
	PANEL_TITLE_STYLE,
	ROOT_STYLE,
	SIGNAL_DOT_STYLE,
} from "./styles"

const THEME_OPTIONS: Theme[] = ["light", "dark", "sepia"]
const LANG_OPTIONS: Lang[] = ["zh", "en"]

function themeLabel(theme: Theme): string {
	if (theme === "dark") return "Dark"
	if (theme === "sepia") return "Sepia"
	return "Light"
}

export function HeartbeatDot() {
	const destination = useEntryStore((s) => s.destination)
	const lang = useLanguageStore((s) => s.lang)
	const setLang = useLanguageStore((s) => s.setLang)
	const theme = useThemeStore((s) => s.theme)
	const setTheme = useThemeStore((s) => s.setTheme)
	const [isOpen, setIsOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement | null>(null)
	const buttonRef = useRef<HTMLButtonElement | null>(null)
	const isInteractive =
		destination !== null && destination.kind !== "transient_logo"
	const isPanelOpen = isOpen && isInteractive
	const title = lang === "en" ? "Interface" : "界面"

	const closePanel = useCallback(() => setIsOpen(false), [])
	const togglePanel = useCallback(() => {
		if (!isInteractive) return
		setIsOpen((current) => !current)
	}, [isInteractive])

	useEffect(() => {
		if (!isPanelOpen) return

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target
			if (!(target instanceof Node)) return
			if (rootRef.current?.contains(target)) return
			closePanel()
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			event.preventDefault()
			closePanel()
			buttonRef.current?.focus()
		}

		window.addEventListener("pointerdown", handlePointerDown)
		window.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown)
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [isPanelOpen, closePanel])

	if (destination === null) return null

	return (
		<div ref={rootRef} className="heartbeat-signal-root" style={ROOT_STYLE}>
			{isPanelOpen && (
				<div
					role="dialog"
					aria-label={title}
					className="heartbeat-signal-panel"
					style={PANEL_STYLE}
				>
					<p style={PANEL_TITLE_STYLE}>{title}</p>
					<div style={ACTION_ROW_STYLE}>
						<span style={ACTION_LABEL_STYLE}>
							{lang === "en" ? "Theme" : "主题"}
						</span>
						<div style={ACTION_VALUE_STYLE} aria-label="Switch theme">
							{THEME_OPTIONS.map((item) => (
								<button
									key={item}
									type="button"
									style={{
										...ACTION_BUTTON_STYLE,
										...(theme === item ? ACTION_BUTTON_ACTIVE_STYLE : null),
									}}
									onClick={() => setTheme(item)}
									aria-pressed={theme === item}
								>
									{themeLabel(item)}
								</button>
							))}
						</div>
					</div>
					<div style={ACTION_ROW_STYLE}>
						<span style={ACTION_LABEL_STYLE}>
							{lang === "en" ? "Language" : "语言"}
						</span>
						<div style={ACTION_VALUE_STYLE} aria-label="Switch language">
							{LANG_OPTIONS.map((item) => (
								<button
									key={item}
									type="button"
									style={{
										...ACTION_BUTTON_STYLE,
										...(lang === item ? ACTION_BUTTON_ACTIVE_STYLE : null),
									}}
									onClick={() => setLang(item)}
									aria-pressed={lang === item}
								>
									{item === "en" ? "EN" : "中文"}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			<button
				ref={buttonRef}
				type="button"
				className="heartbeat-signal-button"
				style={{
					...DOT_BUTTON_STYLE,
					...(isPanelOpen ? DOT_BUTTON_ACTIVE_STYLE : null),
					...(!isInteractive ? DOT_BUTTON_DISABLED_STYLE : null),
				}}
				disabled={!isInteractive}
				aria-label="Open interface settings"
				aria-haspopup="dialog"
				aria-expanded={isPanelOpen}
				onClick={togglePanel}
			>
				<span style={SIGNAL_DOT_STYLE} aria-hidden="true" />
			</button>
		</div>
	)
}
