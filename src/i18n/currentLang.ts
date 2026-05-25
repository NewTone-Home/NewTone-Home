import type { UILang } from "./types"
import { useLanguageStore } from "../store/useLanguageStore"

// 当前 UI 语言 —— 同步读 zustand store
// 用于非 React 上下文（如 t() / localized() 直接调用）。
// 在 React 组件中应优先用 useT() 订阅 store 触发重渲染。
export function getCurrentUILang(): UILang {
	return useLanguageStore.getState().lang
}
