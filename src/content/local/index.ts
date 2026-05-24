import * as novels from "./novels"
import * as worlds from "./worlds"
import * as arcs from "./arcs"
import * as chapters from "./chapters"
import * as characters from "./characters"
import * as assets from "./assets"
import * as featured from "./featured"
import type { ContentAdapter } from "../adapter"

// 本地适配器 —— 组合各实体模块为统一 ContentAdapter
// 加新实体类型？只需：建新 ./newEntity.ts → 加一行 import → spread 进去
export const localAdapter: ContentAdapter = {
  ...novels,
  ...worlds,
  ...arcs,
  ...chapters,
  ...characters,
  ...assets,
  ...featured,
}
