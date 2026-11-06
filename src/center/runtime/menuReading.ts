export function isWallMenuReading(entityId: string | undefined) {
  return entityId === 'commercial-s5-milk-tea-menu-service-label' || entityId === 'fruit-tea-trial-menu' || entityId === 'commercial-cafe-menu' || entityId === 'yonghe-menu'
}

export type WallMenuItem = { name: string; price: string; description: string | null }

/** Parses "name  price" lines (optionally followed by one description line) into menu rows; null when the text is not a priced menu. */
export function parseWallMenuText(text: string): WallMenuItem[] | null {
  const items: WallMenuItem[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const priced = line.match(/^(.+?)\s{2,}(\d+(?:\.\d+)?)$/)
    if (priced) { items.push({ name: priced[1]!.trim(), price: priced[2]!, description: null }); continue }
    const last = items[items.length - 1]
    if (last && last.description === null) items[items.length - 1] = { ...last, description: line }
    else return null
  }
  return items.length ? items : null
}
