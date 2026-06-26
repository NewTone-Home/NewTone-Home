import { create } from "zustand"
import { readStorage, writeStorage } from "../lib/storage"

export type Theme = "light" | "dark" | "sepia"

const THEME_CYCLE: Theme[] = ["light", "dark", "sepia"]

function applyThemeToDom(theme: Theme): void {
	if (typeof document !== "undefined") {
		document.documentElement.setAttribute("data-theme", theme)
	}
}

function persistTheme(theme: Theme): void {
	const state = readStorage()
	writeStorage({
		...state,
		preferences: { ...(state.preferences ?? {}), theme },
	})
}

function readInitialTheme(): Theme {
	return readStorage().preferences?.theme ?? "dark"
}

const initialTheme = readInitialTheme()
applyThemeToDom(initialTheme)

type ThemeStore = {
	theme: Theme
	setTheme: (t: Theme) => void
	cycleTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
	theme: initialTheme,
	setTheme: (t) => {
		set({ theme: t })
		applyThemeToDom(t)
		persistTheme(t)
	},
	cycleTheme: () => {
		const cur = get().theme
		const idx = THEME_CYCLE.indexOf(cur)
		const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
		get().setTheme(next)
	},
}))
