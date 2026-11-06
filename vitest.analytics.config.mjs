import { defineConfig } from 'vitest/config'
export default defineConfig({ cacheDir: '.analytics-vite-cache', test: {
 include: ['src/services/analyticsV030.test.js','src/services/interactionSessions.test.js','src/services/locationActivity.test.js','src/services/storyAnalytics.test.js','src/services/shopAnalytics.test.js','src/services/shopAnalyticsIntegration.test.js','src/services/sessionActivityTracker.test.js','src/services/landingEntryObserver.test.mjs','src/center/runtime/shopOrderPayment.test.ts','src/center/runtime/crossShopOrders.test.ts','src/center/runtime/cafeStoryOrderDelivery.test.ts','src/admin/releaseAnalyticsContract.test.js','tests/analytics*.test.js','tests/centerAnalytics.test.js','tests/chapterTwoAnalytics.test.js','tests/sessionTrajectoryAnalyticsMigration.test.js','tests/landingEntryLanguageAnalytics.test.js'],
 maxWorkers: 1,
} })
