// 运行时路由:现在该显示哪一屏

export type EntryDestination =
  | { kind: "full_logo" }
  | { kind: "transient_logo"; next: EntryDestination }
  | { kind: "world_hall"; worldId: string }
  | { kind: "multiverse" }
  | { kind: "chapter"; chapterId: string }
