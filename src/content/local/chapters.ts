import data from "../../../content/data/chapters.json"
import type { Chapter } from "../../types"

const CHAPTERS = data as Chapter[]

export function getChapters(): Chapter[] {
  return CHAPTERS
}

export function getChapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

export function getChaptersByArcId(arcId: string): Chapter[] {
  return CHAPTERS.filter((c) => c.arcId === arcId)
}
