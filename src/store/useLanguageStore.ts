import { create } from "zustand"
import { readStorage, writeStorage } from "../lib/storage"

export type Lang = "zh" | "en"

const LANG_CYCLE: Lang[] = ["zh", "en"]

function persistLang(lang: Lang): void {
	const state = readStorage()
	const nextPrefs = { ...(state.preferences ?? {}), language: lang }
	writeStorage({ ...state, preferences: nextPrefs })
}

function readInitialLang(): Lang {
	const lang = readStorage().preferences?.language
	if (lang === "en" || lang === "zh") return lang
	return "zh"
}

const initialLang = readInitialLang()

type LanguageStore = {
	lang: Lang
	setLang: (l: Lang) => void
	cycleLang: () => void
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
	lang: initialLang,
	setLang: (l) => {
		set({ lang: l })
		persistLang(l)
	},
	cycleLang: () => {
		const cur = get().lang
		const idx = LANG_CYCLE.indexOf(cur)
		const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length]
		get().setLang(next)
	},
}))
