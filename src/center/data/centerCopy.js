const copy = {
  zh: {
    center: 'CENTER', city: '未命名城区 · 01', back: '返回入口', mapLabel: '交互式城区地图',
    zoomIn: '放大', zoomOut: '缩小', reset: '重置地图', close: '关闭信息', open: '打开记录', closeRecord: '收起记录',
    status: '状态', type: '类型', unlocked: '已解锁', locked: '未解锁', linked: '关联层', worldFeed: 'WORLD FEED',
    hintDesktop: '拖动移动 · 滚轮缩放 · 点击地点', hintTouch: '拖动移动 · 双指缩放 · 轻触地点', placeholder: '演示记录',
  },
  en: {
    center: 'CENTER', city: 'UNNAMED DISTRICT · 01', back: 'RETURN', mapLabel: 'Interactive district map',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset map', close: 'Close information', open: 'OPEN RECORD', closeRecord: 'COLLAPSE RECORD',
    status: 'STATUS', type: 'TYPE', unlocked: 'UNLOCKED', locked: 'LOCKED', linked: 'LINKED LAYERS', worldFeed: 'WORLD FEED',
    hintDesktop: 'Drag to move · wheel to zoom · select a place', hintTouch: 'Drag to move · pinch to zoom · tap a place', placeholder: 'DEMO RECORD',
  },
}

export function getCenterCopy(language) {
  return copy[language] || copy.en
}

