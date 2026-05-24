// UI 语言代码（content 层用 LocalizedString，UI 层用这个）

export type UILang = "zh" | "en"

// UI 字符串字典 shape —— 所有语言 JSON 必须匹配
export type UIStrings = {
  entry: {
    anyKeyHint: string
    startFromBeginning: string
    iveBeenHere: string
  }
  placeholder: {
    worldHall: string
    multiverse: string
  }
  dev: {
    resetLocalStorage: string
  }
}
