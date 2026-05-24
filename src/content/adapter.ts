import type { Novel, World, Arc, Chapter, Character, Asset } from "../types"

// 内容适配器接口 —— UI 永远只通过这层访问内容
// 当前实现：local（本地 JSON）
// 未来实现：notion / cloudinary（不动 UI 即可切换）
export type ContentAdapter = {
  // 作品
  getNovels(): Novel[]
  getNovelById(id: string): Novel | undefined

  // 世界
  getWorlds(): World[]
  getWorldById(id: string): World | undefined
  getWorldsByNovelId(novelId: string): World[]

  // 卷
  getArcs(): Arc[]
  getArcById(id: string): Arc | undefined
  getArcsByWorldId(worldId: string): Arc[]

  // 章节
  getChapters(): Chapter[]
  getChapterById(id: string): Chapter | undefined
  getChaptersByArcId(arcId: string): Chapter[]

  // 角色
  getCharacters(): Character[]
  getCharacterById(id: string): Character | undefined
  getCharactersByNovelId(novelId: string): Character[]

  // 资源
  getAssets(): Asset[]
  getAssetById(id: string): Asset | undefined

  // 主推
  getFeaturedWorld(): World | undefined
}
