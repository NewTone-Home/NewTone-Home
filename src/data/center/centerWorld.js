export const CENTER_ROOT_ID = 'known-country'

export const centerWorld = {
  'known-country': {
    id: 'known-country',
    type: 'overview',
    title: '当前国家 · 已知区域',
    description: '目前被正文确认过的表里世界范围。',
    nodes: ['surface-estate', 'inner-main-city', 'inner-mining-outskirts'],
  },
  'surface-estate': {
    id: 'surface-estate',
    parentId: 'known-country',
    type: 'region',
    world: 'surface',
    title: '姬家祖宅',
    annotation: '表世界目前唯一确认的地点。',
    description: '祖宅正厅的暗门连接着里世界。',
    x: 48,
    y: 43,
    width: 27,
    height: 25,
    nodes: [],
    contentOptions: [
      { id: 'estate-passage', title: '暗门与通道', description: '连接表世界与里世界的固定入口。' },
    ],
  },
  'inner-main-city': {
    id: 'inner-main-city',
    parentId: 'known-country',
    type: 'region',
    world: 'inner',
    title: '主城区',
    annotation: '里世界当前主要生活与调查区域。',
    description: '商业街与咖啡馆位于这里。',
    x: 36,
    y: 49,
    width: 34,
    height: 30,
    nodes: ['inner-cafe'],
  },
  'inner-cafe': {
    id: 'inner-cafe',
    parentId: 'inner-main-city',
    type: 'place',
    world: 'inner',
    title: '咖啡馆',
    annotation: '修杰在这里先后见过两名线人。',
    description: '同一个地点承载了两次不同的调查会面。',
    x: 50,
    y: 50,
    width: 36,
    height: 30,
    nodes: [],
    contentOptions: [
      { id: 'cafe-zhou', title: '与老周会面', description: '陈副部长失踪与矿区老街的线索。' },
      { id: 'cafe-ruoyu', title: '与若雨会面', description: '晶石转运记录与异常补录。' },
    ],
  },
  'inner-mining-outskirts': {
    id: 'inner-mining-outskirts',
    parentId: 'known-country',
    type: 'region',
    world: 'inner',
    title: '矿区外围',
    annotation: '晶石体系外沿的旧工业生活区。',
    description: '外围老街与永和小馆位于这里。',
    x: 68,
    y: 54,
    width: 32,
    height: 28,
    nodes: ['inner-yonghe-diner'],
  },
  'inner-yonghe-diner': {
    id: 'inner-yonghe-diner',
    parentId: 'inner-mining-outskirts',
    type: 'place',
    world: 'inner',
    title: '永和小馆',
    annotation: '陈副部长失踪前疑似多次出现于此。',
    description: '修杰在后门与窄巷发现了不自然的痕迹。',
    x: 50,
    y: 48,
    width: 38,
    height: 31,
    nodes: [],
    contentOptions: [
      { id: 'diner-investigation', title: '第一次调查', description: '馄饨、布帘、后门与新鲜木屑。' },
      { id: 'back-alley-locked', title: '后巷异常', description: '已发现，但目前尚未开放。', locked: true },
    ],
  },
}

export function getCenterNode(nodeId) {
  return centerWorld[nodeId] ?? centerWorld[CENTER_ROOT_ID]
}

export function getCenterChildren(nodeId) {
  const node = getCenterNode(nodeId)
  return node.nodes.map(childId => centerWorld[childId]).filter(Boolean)
}
