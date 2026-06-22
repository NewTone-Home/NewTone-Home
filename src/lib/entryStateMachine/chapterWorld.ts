import { FEATURED_WORLD_ID } from "../../config/featured"
import { defaultAdapter } from "../../content"

export function worldIdForChapter(chapterId: string): string {
  const chapter = defaultAdapter.getChapterById(chapterId)
  if (!chapter) return FEATURED_WORLD_ID

  const arc = defaultAdapter.getArcById(chapter.arcId)
  return arc?.worldId ?? FEATURED_WORLD_ID
}
