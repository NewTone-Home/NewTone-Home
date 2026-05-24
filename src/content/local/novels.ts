import data from "../../../content/data/novels.json"
import type { Novel } from "../../types"

const NOVELS = data as Novel[]

export function getNovels(): Novel[] {
  return NOVELS
}

export function getNovelById(id: string): Novel | undefined {
  return NOVELS.find((n) => n.id === id)
}
