import { useEntryStore } from "../../store"
import { devResetButtonStyle } from "./styles"

// 仅 dev 模式显示的存档清理按钮（左下角）
// 点击后：清空 localStorage + 重新加载页面
export function DevResetButton() {
  const resetStorage = useEntryStore((s) => s.resetStorage)

  if (!import.meta.env.DEV) return null

  function handleClick() {
    resetStorage()
    window.location.reload()
  }

  return (
    <button style={devResetButtonStyle} onClick={handleClick}>
      [dev] reset
    </button>
  )
}
