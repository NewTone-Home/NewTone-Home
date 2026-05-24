// 默认内容适配器
//
// 切换实现方式（未来）：
//   把下面 export 改为：
//     export { notionAdapter as defaultAdapter } from "./notion"
//   或
//     export { cloudinaryAdapter as defaultAdapter } from "./cloudinary"
//   整个 UI 代码不动

export { localAdapter as defaultAdapter } from "./local"
export type { ContentAdapter } from "./adapter"
