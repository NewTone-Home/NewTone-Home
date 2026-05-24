import data from "../../../content/data/characters.json"
import type { Character } from "../../types"

const CHARACTERS = data as Character[]

export function getCharacters(): Character[] {
  return CHARACTERS
}

export function getCharacterById(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id)
}

export function getCharactersByNovelId(novelId: string): Character[] {
  return CHARACTERS.filter((c) => c.novelId === novelId)
}
