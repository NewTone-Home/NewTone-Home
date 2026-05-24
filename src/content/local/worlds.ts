import data from "../../../content/data/worlds.json"
import type { World } from "../../types"

const WORLDS = data as World[]

export function getWorlds(): World[] {
  return WORLDS
}

export function getWorldById(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id)
}

export function getWorldsByNovelId(novelId: string): World[] {
  return WORLDS.filter((w) => w.novelId === novelId)
}
