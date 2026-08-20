const localized = (zh, en) => Object.freeze({ zh, en })

export const CENTER_REGIONS = Object.freeze([
  {
    id: 'north-archive-district',
    kind: 'region',
    entityType: 'Region',
    interactive: true,
    name: localized('北部档案区', 'North Archive District'),
    status: 'active',
    unlocked: true,
    summary: localized('旧城区保存最完整的公共记录层。', 'The old quarter keeps the city’s most complete public record layer.'),
    details: localized('道路沿着旧地基重新描绘，档案馆与观测所仍维持低频开放。', 'Roads follow the old foundations; the archive and observatory remain available at low frequency.'),
    geometry: { points: [[0, 0], [7, 0], [7, 6], [0, 6]] },
    links: { reader: null, news: ['feed-archive'], missions: [], route: null },
  },
  {
    id: 'east-signal-district',
    kind: 'region',
    entityType: 'Region',
    interactive: true,
    name: localized('东部信号区', 'East Signal District'),
    status: 'watch',
    unlocked: true,
    summary: localized('城市广播与远距观测在这里交汇。', 'City broadcasts and long-range observation converge here.'),
    details: localized('塔台之间保留着一条未经公开标注的同步链路。', 'An unlisted synchronization link remains between the towers.'),
    geometry: { points: [[7, 0], [14, 0], [14, 7], [7, 7]] },
    links: { reader: null, news: ['feed-observatory'], missions: [], route: null },
  },
  {
    id: 'south-transit-district',
    kind: 'region',
    entityType: 'Region',
    interactive: true,
    name: localized('南部通行区', 'South Transit District'),
    status: 'active',
    unlocked: true,
    summary: localized('市集、车站与维护工坊组成的流动层。', 'A moving layer formed by the market, station, and maintenance works.'),
    details: localized('这里的事件更新最快，也是最适合继续扩展内容的区域。', 'Events update fastest here, making it the natural place to extend future content.'),
    geometry: { points: [[0, 6], [14, 6], [14, 13], [0, 13]] },
    links: { reader: null, news: ['feed-station'], missions: [], route: null },
  },
])

export const CENTER_ROUTES = Object.freeze([
  {
    id: 'archive-spine',
    kind: 'route',
    entityType: 'Route',
    interactive: false,
    name: localized('档案轴线', 'Archive Spine'),
    status: 'open',
    unlocked: true,
    geometry: { points: [[1, 3.5], [5, 3.5], [8, 6.5], [13, 6.5]] },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'south-loop',
    kind: 'route',
    entityType: 'Route',
    interactive: false,
    name: localized('南部环线', 'South Loop'),
    status: 'open',
    unlocked: true,
    geometry: { points: [[1, 9], [4, 6], [9, 6], [13, 10], [9, 12], [3, 12], [1, 9]] },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'signal-link',
    kind: 'route',
    entityType: 'Route',
    interactive: false,
    name: localized('信号链路', 'Signal Link'),
    status: 'restricted',
    unlocked: false,
    geometry: { points: [[8.5, 2], [10.5, 4], [12, 8]] },
    links: { reader: null, news: [], missions: [], route: null },
  },
])

export const CENTER_BUILDINGS = Object.freeze([
  {
    id: 'memory-archive', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('记忆档案馆', 'Memory Archive'), status: 'active', unlocked: true,
    summary: localized('保存已公开叙事与地点记录的主档案。', 'The primary archive for released narrative and location records.'),
    details: localized('后续可绑定 Reader 章节、世界条目、新闻与解锁记录。当前展示的是占位档案。', 'Later this entity can bind Reader chapters, world entries, news, and unlock history. The current record is a placeholder.'),
    geometry: { x: 1.3, y: 1.2, width: 2.4, depth: 2, height: 3.2 },
    links: { reader: 'chapter-01', news: ['feed-archive'], missions: [], route: 'archive-spine' },
  },
  {
    id: 'north-observatory', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('北部观测所', 'North Observatory'), status: 'watch', unlocked: true,
    summary: localized('持续记录城区边界之外的微弱变化。', 'Continuously records faint changes beyond the district boundary.'),
    details: localized('观测结果只以低频事件形式进入 World Feed。', 'Observations enter the World Feed only as low-frequency events.'),
    geometry: { x: 8.1, y: 1.1, width: 2, depth: 1.9, height: 4.5 },
    links: { reader: null, news: ['feed-observatory'], missions: ['observe-01'], route: 'signal-link' },
  },
  {
    id: 'civic-assembly', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('市政集会所', 'Civic Assembly'), status: 'quiet', unlocked: true,
    summary: localized('城市公共议程的占位节点。', 'A placeholder node for the city’s public agenda.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 11.1, y: 3.1, width: 2.1, depth: 2.4, height: 2.6 },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'crossing-market', kind: 'building', entityType: 'Building', interactive: true,
    name: localized('交汇市集', 'Crossing Market'), status: 'active', unlocked: true,
    summary: localized('区域事件最密集的公共交换地点。', 'The public exchange with the highest density of regional events.'),
    details: localized('这里适合承载短新闻、人物片段与一次性互动。', 'A natural home for short news, character fragments, and one-step interactions.'),
    geometry: { x: 4.1, y: 5.1, width: 2.8, depth: 2.2, height: 1.8 },
    links: { reader: null, news: ['feed-market'], missions: ['market-01'], route: 'south-loop' },
  },
  {
    id: 'west-clinic', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('西侧诊所', 'West Clinic'), status: 'quiet', unlocked: true,
    summary: localized('维持基础服务的低层建筑。', 'A low structure maintaining basic services.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 0.8, y: 7.2, width: 2.1, depth: 1.7, height: 1.6 },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'south-station', kind: 'building', entityType: 'PointOfInterest', interactive: true,
    name: localized('南部换乘站', 'South Transfer'), status: 'active', unlocked: true,
    summary: localized('连接城区各层级的通行节点。', 'A transit node linking the city’s different layers.'),
    details: localized('未来可作为进入下一级区域、任务或独立场景的入口。', 'Later this can open a deeper region, mission, or standalone scene.'),
    geometry: { x: 7.7, y: 7.3, width: 3, depth: 1.8, height: 2.2 },
    links: { reader: null, news: ['feed-station'], missions: ['transit-01'], route: 'south-loop' },
  },
  {
    id: 'signal-tower', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('信号塔', 'Signal Tower'), status: 'unstable', unlocked: true,
    summary: localized('向全城投递低强度同步信号。', 'Broadcasts a low-intensity synchronization signal across the city.'),
    details: localized('当前读数存在轻微漂移；信息层保持可访问，但不会阻塞点击。', 'The current reading drifts slightly; its information remains accessible without blocking direct interaction.'),
    geometry: { x: 11.6, y: 8.1, width: 1.3, depth: 1.3, height: 6.2 },
    links: { reader: null, news: ['feed-signal'], missions: ['signal-01'], route: 'signal-link' },
  },
  {
    id: 'maintenance-works', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('维护工坊', 'Maintenance Works'), status: 'active', unlocked: true,
    summary: localized('维护道路与结构线的后台节点。', 'A service node maintaining roads and structural lines.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 4.5, y: 9.2, width: 2.3, depth: 2.1, height: 2 },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'terraced-residences', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('阶地住区', 'Terraced Residences'), status: 'quiet', unlocked: true,
    summary: localized('沿南部边界排列的生活区。', 'A residential strip along the southern boundary.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 1.4, y: 10.1, width: 2.6, depth: 2.1, height: 2.8 },
    links: { reader: null, news: [], missions: [], route: null },
  },
])

export const CENTER_POINTS = Object.freeze([
  {
    id: 'relay-17', kind: 'point', entityType: 'PointOfInterest', interactive: true,
    name: localized('中继点 17', 'Relay 17'), status: 'online', unlocked: true,
    summary: localized('一处仍在回应的城市中继节点。', 'A city relay node that is still responding.'),
    details: localized('点击新闻时可把这种节点作为地图高亮目标。', 'News items can use nodes like this as map highlight targets.'),
    geometry: { point: [6.8, 4.8] },
    links: { reader: null, news: ['feed-relay'], missions: [], route: 'archive-spine' },
  },
])

export const CENTER_ENTITIES = Object.freeze([
  ...CENTER_REGIONS,
  ...CENTER_ROUTES,
  ...CENTER_BUILDINGS,
  ...CENTER_POINTS,
])

export const CENTER_ENTITY_BY_ID = new Map(CENTER_ENTITIES.map(entity => [entity.id, entity]))

export const CENTER_NEWS = Object.freeze([
  { id: 'feed-archive', entityId: 'memory-archive', text: localized('档案馆恢复了一段缺失索引。', 'The archive recovered a missing index segment.') },
  { id: 'feed-observatory', entityId: 'north-observatory', text: localized('北部边界记录到一次低强度偏移。', 'A low-intensity shift was recorded at the northern boundary.') },
  { id: 'feed-market', entityId: 'crossing-market', text: localized('交汇市集延长了今晚的开放时间。', 'Crossing Market extended tonight’s opening window.') },
  { id: 'feed-station', entityId: 'south-station', text: localized('南部环线恢复双向通行。', 'The South Loop resumed two-way transit.') },
  { id: 'feed-signal', entityId: 'signal-tower', text: localized('信号塔同步率下降 0.7%。', 'Signal Tower synchronization fell by 0.7%.') },
  { id: 'feed-relay', entityId: 'relay-17', text: localized('中继点 17 在静默后重新上线。', 'Relay 17 returned online after a silent interval.') },
])

export function centerText(value, language = 'en') {
  if (typeof value === 'string') return value
  return value?.[language] || value?.en || value?.zh || ''
}

export function getCenterEntity(entityId) {
  return CENTER_ENTITY_BY_ID.get(entityId) || null
}

