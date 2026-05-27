import type {
  LocalizedString,
  Timestamped,
  SoftDeletable,
  Publishable,
  Taggable,
} from "./common"

// Frame 3 段落语义类型 — 决定字号节奏与焦点淡入行为
// open     开场大字独占
// narrate  叙述小字窄栏左对齐
// key      关键句大字独占
// thought  内心斜体小字
// dialogue 对话中字开间距
// pause    静默加宽字距
export type ChapterParagraphType =
  | "open"
  | "narrate"
  | "key"
  | "thought"
  | "dialogue"
  | "pause"

export type ChapterParagraph = {
  type: ChapterParagraphType
  text: LocalizedString
}

export type Chapter = {
  id: string
  arcId: string
  order: number
  title: LocalizedString
  paragraphs?: ChapterParagraph[]
  body?: LocalizedString
  characterIds?: string[]
  events?: string[]
  accessLevel?: "public" | "broken_seal"
} & Timestamped & SoftDeletable & Publishable & Taggable
