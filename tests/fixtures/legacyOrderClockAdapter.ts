export type LegacyMilkTeaOrderFixture = Readonly<{
  number: number
  createdAt?: unknown
  readyAt?: unknown
  held?: boolean
  readyAnalyticsMarker?: unknown
  migrationVersion?: number
  readyAtGameTicks?: number
  migrationKey?: string
}>

export type LegacyOrderFixtureMigration =
  | Readonly<{ status: 'migrated'; order: LegacyMilkTeaOrderFixture }>
  | Readonly<{ status: 'already-migrated'; order: LegacyMilkTeaOrderFixture }>
  | Readonly<{ status: 'blocked'; original: LegacyMilkTeaOrderFixture; reason: string }>

/**
 * Test-only bridge model. It is not imported by production code and does not
 * define the product migration policy for real in-progress orders.
 */
export function migrateLegacyOrderFixture(
  order: LegacyMilkTeaOrderFixture,
  currentWorldTimeTicks: number,
  explicitFallbackPreparationTicks: number,
): LegacyOrderFixtureMigration {
  if (!Number.isSafeInteger(order.number) || order.number < 1) {
    return { status: 'blocked', original: order, reason: 'invalid-order-number' }
  }
  if (!Number.isSafeInteger(currentWorldTimeTicks) || currentWorldTimeTicks < 0) {
    return { status: 'blocked', original: order, reason: 'invalid-world-time' }
  }
  if (!Number.isSafeInteger(explicitFallbackPreparationTicks) || explicitFallbackPreparationTicks < 0) {
    return { status: 'blocked', original: order, reason: 'invalid-explicit-fallback' }
  }

  const migrationKey = 'legacy-milktea-v1:' + order.number
  if (order.migrationVersion === 1 && order.migrationKey === migrationKey
    && Number.isSafeInteger(order.readyAtGameTicks)) {
    return { status: 'already-migrated', order }
  }

  // Epoch timestamps are preserved as legacy evidence but never compared with world ticks.
  const migrated: LegacyMilkTeaOrderFixture = {
    ...order,
    migrationVersion: 1,
    migrationKey,
    readyAtGameTicks: currentWorldTimeTicks + explicitFallbackPreparationTicks,
  }
  if (!Number.isSafeInteger(migrated.readyAtGameTicks)) {
    return { status: 'blocked', original: order, reason: 'world-time-overflow' }
  }
  return { status: 'migrated', order: migrated }
}
