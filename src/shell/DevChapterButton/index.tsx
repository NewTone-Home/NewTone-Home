import { useEntryStore } from "../../store"
import { devChapterButtonStyle } from "./styles"

const TEST_CHAPTER_ID = "chumo-arc1-ch3"

export function DevChapterButton() {
  const goTo = useEntryStore((s) => s.goTo)

  if (!import.meta.env.DEV) return null

  function handleClick() {
    goTo({ kind: "chapter", chapterId: TEST_CHAPTER_ID })
  }

  return (
    <button
      style={devChapterButtonStyle}
      onClick={handleClick}
      aria-label="Open test chapter"
    >
      [dev] ch3
    </button>
  )
}
