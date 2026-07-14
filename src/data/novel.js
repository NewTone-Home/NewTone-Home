const placeholder = (prefix, n) =>
  Array.from({ length: n }, (_, i) => `${prefix} 第 ${i + 1} 段。这是占位内容，用于测试滚屏和阶段识别。每段文字足够长，确保页面高度可以触发 IntersectionObserver。这里没有实际小说内容，只有测试数据。`)

export const readingBlocks = [
  {
    id: 1,
    phase: 'M1',
    paragraphs: placeholder('第一乐章', 10),
  },
  {
    id: 2,
    phase: 'M2',
    paragraphs: placeholder('第二乐章', 10),
  },
  {
    id: 3,
    phase: 'M3',
    paragraphs: placeholder('第三乐章', 10),
  },
  {
    id: 4,
    phase: 'M4',
    paragraphs: placeholder('第四乐章', 10),
  },
]
