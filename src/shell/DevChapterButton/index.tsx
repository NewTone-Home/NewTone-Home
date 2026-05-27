import { useEntryStore } from "../../store"
import { devChapterButtonStyle } from "./styles"

// 仅 dev 模式显示的「跳到测试章节」按钮(左下角, reset 上方)
// 点击后: goTo chapter destination (验证 Frame 3 用)
export function DevChapterButton() {
  const goTo = useEntryStore((s) => s.goTo)

  if (!import.meta.env.DEV) return null

  function handleClick() {
    goTo({ kind: "chapter", chapterId: "chumo-arc1-ch3" })
  }

  return (
    <button style={devChapterButtonStyle} onClick={handleClick}>
      [dev] → ch3
    </button>
  )
}
