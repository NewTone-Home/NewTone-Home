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

// These are intentionally non-interactive. They make the map read like a
// continuous place without turning every drawn line into a product surface.
// Future districts can extend the same records with ownership, unlock state,
// or a route target when a parcel itself becomes navigable.
export const CENTER_PARCELS = Object.freeze([
  { id: 'archive-court', regionId: 'north-archive-district', use: 'civic', geometry: { points: [[.45, .6], [4.15, .6], [4.15, 3.15], [.45, 3.15]] } },
  { id: 'archive-yard', regionId: 'north-archive-district', use: 'garden', geometry: { points: [[4.45, .65], [6.55, .65], [6.55, 2.95], [4.45, 2.95]] } },
  { id: 'observatory-court', regionId: 'east-signal-district', use: 'civic', geometry: { points: [[7.55, .45], [10.55, .45], [10.55, 3.35], [7.55, 3.35]] } },
  { id: 'assembly-terrace', regionId: 'east-signal-district', use: 'civic', geometry: { points: [[10.7, 2.55], [13.65, 2.55], [13.65, 5.75], [10.7, 5.75]] } },
  { id: 'market-square', regionId: 'south-transit-district', use: 'market', geometry: { points: [[3.4, 4.75], [7.35, 4.75], [7.35, 7.75], [3.4, 7.75]] } },
  { id: 'station-platform', regionId: 'south-transit-district', use: 'transit', geometry: { points: [[7.3, 6.9], [11.1, 6.9], [11.1, 9.45], [7.3, 9.45]] } },
  { id: 'clinic-yard', regionId: 'south-transit-district', use: 'service', geometry: { points: [[.45, 6.75], [3.25, 6.75], [3.25, 9.55], [.45, 9.55]] } },
  { id: 'works-yard', regionId: 'south-transit-district', use: 'service', geometry: { points: [[4.15, 8.7], [7.3, 8.7], [7.3, 11.75], [4.15, 11.75]] } },
  { id: 'residence-court', regionId: 'south-transit-district', use: 'residential', geometry: { points: [[.65, 9.7], [4.2, 9.7], [4.2, 12.65], [.65, 12.65]] } },
  { id: 'signal-yard', regionId: 'south-transit-district', use: 'infrastructure', geometry: { points: [[10.8, 7.55], [13.55, 7.55], [13.55, 10.2], [10.8, 10.2]] } },
])

// Street furniture is a light, data-driven visual layer. It is not a new
// content type yet; keeping it separate stops decorative density from
// confusing the interaction model for actual world entities.
export const CENTER_URBAN_DETAILS = Object.freeze([
  { id: 'archive-tree-01', kind: 'tree', point: [4.62, 1.15], height: 1.05, scale: .78 },
  { id: 'archive-tree-02', kind: 'tree', point: [5.75, 2.35], height: .88, scale: .68 },
  { id: 'archive-lamp-01', kind: 'lamp', point: [3.96, 3.55], height: 1.15 },
  { id: 'archive-lamp-02', kind: 'lamp', point: [5.35, 3.6], height: 1.15 },
  { id: 'observatory-tree-01', kind: 'tree', point: [10.55, 1.2], height: 1.1, scale: .72 },
  { id: 'observatory-lamp-01', kind: 'lamp', point: [9.45, 3.75], height: 1.05 },
  { id: 'assembly-lamp-01', kind: 'lamp', point: [11.2, 5.7], height: 1.05 },
  { id: 'market-tree-01', kind: 'tree', point: [3.45, 6.8], height: .9, scale: .68 },
  { id: 'market-tree-02', kind: 'tree', point: [7.12, 5.15], height: .95, scale: .7 },
  { id: 'market-lamp-01', kind: 'lamp', point: [6.9, 7.35], height: 1.05 },
  { id: 'clinic-tree-01', kind: 'tree', point: [3.1, 8.55], height: .82, scale: .62 },
  { id: 'station-lamp-01', kind: 'lamp', point: [8.1, 9.05], height: 1.1 },
  { id: 'station-lamp-02', kind: 'lamp', point: [10.75, 7.15], height: 1.1 },
  { id: 'works-tree-01', kind: 'tree', point: [6.98, 10.95], height: .78, scale: .6 },
  { id: 'residence-tree-01', kind: 'tree', point: [4.04, 11.35], height: .86, scale: .65 },
  { id: 'signal-lamp-01', kind: 'lamp', point: [12.92, 9.72], height: 1.15 },
  { id: 'market-kiosk-01', kind: 'kiosk', point: [3.7, 5.05], width: .55, depth: .45, height: .72 },
  { id: 'market-kiosk-02', kind: 'kiosk', point: [6.75, 6.95], width: .55, depth: .45, height: .72 },
  { id: 'station-marker', kind: 'marker', point: [7.4, 8.8] },
])

// Background massing keeps the district continuous while preserving a small,
// intentional set of places that can open information. These records never
// enter CENTER_ENTITIES and therefore cannot steal focus or panel state.
export const CENTER_STATIC_MASSINGS = Object.freeze([
  { id: 'archive-index-wing', geometry: { x: 3.95, y: 1.1, width: .82, depth: 1.25, height: 1.45 }, visual: { roof: 'flat', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'archive-service-court', geometry: { x: .65, y: 3.22, width: 1.25, depth: .5, height: .7 }, visual: { roof: 'flat', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'north-records-row', geometry: { x: 5.15, y: .82, width: 1.02, depth: .58, height: 1.16 }, visual: { roof: 'gable', roofAxis: 'x', roofRise: .42, facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'observatory-service-wing', geometry: { x: 9.95, y: 2.05, width: .78, depth: 1.1, height: 1.22 }, visual: { roof: 'flat', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'signal-archive-row', geometry: { x: 7.45, y: 3.85, width: 2.08, depth: .62, height: 1.1 }, visual: { roof: 'sawtooth', roofAxis: 'x', facade: { east: [3, 1], west: [3, 1] } } },
  { id: 'assembly-side-pavilion', geometry: { x: 12.72, y: 2.45, width: .55, depth: .72, height: 1.05 }, visual: { roof: 'terrace', facade: { east: [1, 1], west: [1, 1] } } },
  { id: 'market-east-stalls', geometry: { x: 6.95, y: 5.1, width: .55, depth: 1.45, height: .95 }, visual: { roof: 'canopy', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'market-west-stalls', geometry: { x: 3.55, y: 6.85, width: 1.18, depth: .45, height: .92 }, visual: { roof: 'canopy', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'clinic-service-wing', geometry: { x: .75, y: 8.95, width: 1.15, depth: .48, height: .72 }, visual: { roof: 'flat', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'station-control-block', geometry: { x: 10.05, y: 7.1, width: .55, depth: .68, height: 1.2 }, visual: { roof: 'flat', facade: { east: [1, 2], west: [1, 2] } } },
  { id: 'works-storage-row', geometry: { x: 6.85, y: 9.05, width: .65, depth: 1.5, height: 1.05 }, visual: { roof: 'sawtooth', roofAxis: 'x', facade: { east: [2, 1], west: [2, 1] } } },
  { id: 'residence-west-row', geometry: { x: .72, y: 10.15, width: .58, depth: 2.2, height: 1.8 }, visual: { roof: 'gable', roofAxis: 'y', roofRise: .5, facade: { east: [1, 2], west: [1, 2] } } },
  { id: 'residence-east-row', geometry: { x: 4.02, y: 10.05, width: .5, depth: 1.3, height: 1.25 }, visual: { roof: 'gable', roofAxis: 'y', roofRise: .42, facade: { east: [1, 1], west: [1, 1] } } },
  { id: 'signal-substation', geometry: { x: 12.88, y: 8.2, width: .45, depth: .6, height: .64 }, visual: { roof: 'flat', facade: { east: [1, 1], west: [1, 1] } } },
])

export const CENTER_BUILDINGS = Object.freeze([
  {
    id: 'memory-archive', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('记忆档案馆', 'Memory Archive'), status: 'active', unlocked: true,
    summary: localized('保存已公开叙事与地点记录的主档案。', 'The primary archive for released narrative and location records.'),
    details: localized('后续可绑定 Reader 章节、世界条目、新闻与解锁记录。当前展示的是占位档案。', 'Later this entity can bind Reader chapters, world entries, news, and unlock history. The current record is a placeholder.'),
    geometry: { x: 1.3, y: 1.2, width: 2.4, depth: 2, height: 3.2 },
    visual: { archetype: 'archive', roof: 'gable', roofAxis: 'x', roofRise: .8, facade: { east: [4, 2], west: [4, 2] }, steps: 'south', annexes: [{ x: .8, y: 2.5, width: .78, depth: .58, height: 1.18 }] },
    links: { reader: 'chapter-01', news: ['feed-archive'], missions: [], route: 'archive-spine' },
  },
  {
    id: 'north-observatory', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('北部观测所', 'North Observatory'), status: 'watch', unlocked: true,
    summary: localized('持续记录城区边界之外的微弱变化。', 'Continuously records faint changes beyond the district boundary.'),
    details: localized('观测结果只以低频事件形式进入 World Feed。', 'Observations enter the World Feed only as low-frequency events.'),
    geometry: { x: 8.1, y: 1.1, width: 2, depth: 1.9, height: 4.5 },
    visual: { archetype: 'observatory', roof: 'dome', roofRise: 1.2, facade: { east: [3, 3], west: [3, 3] }, steps: 'south' },
    links: { reader: null, news: ['feed-observatory'], missions: ['observe-01'], route: 'signal-link' },
  },
  {
    id: 'civic-assembly', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('市政集会所', 'Civic Assembly'), status: 'quiet', unlocked: true,
    summary: localized('城市公共议程的占位节点。', 'A placeholder node for the city’s public agenda.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 11.1, y: 3.1, width: 2.1, depth: 2.4, height: 2.6 },
    visual: { archetype: 'assembly', roof: 'terrace', facade: { east: [4, 2], west: [4, 2] }, steps: 'south', annexes: [{ x: 10.75, y: 4.8, width: .72, depth: .52, height: .72 }] },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'crossing-market', kind: 'building', entityType: 'Building', interactive: true,
    name: localized('交汇市集', 'Crossing Market'), status: 'active', unlocked: true,
    summary: localized('区域事件最密集的公共交换地点。', 'The public exchange with the highest density of regional events.'),
    details: localized('这里适合承载短新闻、人物片段与一次性互动。', 'A natural home for short news, character fragments, and one-step interactions.'),
    geometry: { x: 4.1, y: 5.1, width: 2.8, depth: 2.2, height: 1.8 },
    visual: { archetype: 'market', roof: 'canopy', facade: { east: [5, 1], west: [5, 1] }, steps: 'south' },
    links: { reader: null, news: ['feed-market'], missions: ['market-01'], route: 'south-loop' },
  },
  {
    id: 'west-clinic', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('西侧诊所', 'West Clinic'), status: 'quiet', unlocked: true,
    summary: localized('维持基础服务的低层建筑。', 'A low structure maintaining basic services.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 0.8, y: 7.2, width: 2.1, depth: 1.7, height: 1.6 },
    visual: { archetype: 'clinic', roof: 'flat', facade: { east: [3, 2], west: [3, 2] }, steps: 'south', annexes: [{ x: 2.32, y: 7.35, width: .45, depth: .6, height: 1.1 }] },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'south-station', kind: 'building', entityType: 'PointOfInterest', interactive: true,
    name: localized('南部换乘站', 'South Transfer'), status: 'active', unlocked: true,
    summary: localized('连接城区各层级的通行节点。', 'A transit node linking the city’s different layers.'),
    details: localized('未来可作为进入下一级区域、任务或独立场景的入口。', 'Later this can open a deeper region, mission, or standalone scene.'),
    geometry: { x: 7.7, y: 7.3, width: 3, depth: 1.8, height: 2.2 },
    visual: { archetype: 'station', roof: 'canopy', facade: { east: [5, 2], west: [5, 2] }, steps: 'south', annexes: [{ x: 7.55, y: 8.78, width: 3.35, depth: .34, height: .42 }] },
    links: { reader: null, news: ['feed-station'], missions: ['transit-01'], route: 'south-loop' },
  },
  {
    id: 'signal-tower', kind: 'building', entityType: 'Landmark', interactive: true,
    name: localized('信号塔', 'Signal Tower'), status: 'unstable', unlocked: true,
    summary: localized('向全城投递低强度同步信号。', 'Broadcasts a low-intensity synchronization signal across the city.'),
    details: localized('当前读数存在轻微漂移；信息层保持可访问，但不会阻塞点击。', 'The current reading drifts slightly; its information remains accessible without blocking direct interaction.'),
    geometry: { x: 11.6, y: 8.1, width: 1.3, depth: 1.3, height: 6.2 },
    visual: { archetype: 'tower', roof: 'spire', roofRise: 1.15, facade: { east: [2, 5], west: [2, 5] }, steps: 'south' },
    links: { reader: null, news: ['feed-signal'], missions: ['signal-01'], route: 'signal-link' },
  },
  {
    id: 'maintenance-works', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('维护工坊', 'Maintenance Works'), status: 'active', unlocked: true,
    summary: localized('维护道路与结构线的后台节点。', 'A service node maintaining roads and structural lines.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 4.5, y: 9.2, width: 2.3, depth: 2.1, height: 2 },
    visual: { archetype: 'works', roof: 'sawtooth', roofAxis: 'x', facade: { east: [4, 2], west: [4, 2] }, steps: 'south' },
    links: { reader: null, news: [], missions: [], route: null },
  },
  {
    id: 'terraced-residences', kind: 'building', entityType: 'Building', interactive: false,
    name: localized('阶地住区', 'Terraced Residences'), status: 'quiet', unlocked: true,
    summary: localized('沿南部边界排列的生活区。', 'A residential strip along the southern boundary.'),
    details: localized('第一版不开放。', 'Not open in the first demo.'),
    geometry: { x: 1.4, y: 10.1, width: 2.6, depth: 2.1, height: 2.8 },
    visual: { archetype: 'residences', roof: 'terraced', facade: { east: [5, 3], west: [5, 3] }, steps: 'south' },
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
