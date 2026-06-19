const DEFAULT_CHAPTER_ID = "chumo-arc1-ch3"

const CHAPTER_BY_CHARACTER_ID: Record<string, string> = {
	"jixiu-jie-zha": DEFAULT_CHAPTER_ID,
}

export function chapterIdForCharacter(characterId: string): string {
	return CHAPTER_BY_CHARACTER_ID[characterId] ?? DEFAULT_CHAPTER_ID
}
