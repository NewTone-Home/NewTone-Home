import { z } from 'zod'

const localizedTextSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1),
  ja: z.string().min(1),
  ko: z.string().min(1),
  fr: z.string().min(1),
})

const readerPositionSchema = z.object({
  phaseId: z.string().min(1),
  pageId: z.string().min(1),
  beatIndex: z.number().int().nonnegative(),
})

const pointSchema = z.object({ x: z.number(), y: z.number() })
const paletteSchema = z.object({
  background: z.number().int().nonnegative(),
  line: z.number().int().nonnegative(),
  accent: z.number().int().nonnegative(),
})

const layerVariantSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).nullable(),
  fallbackPalette: paletteSchema,
})

const layerSchema = z.object({
  id: z.enum(['surface', 'inner']),
  defaultVariant: z.string().min(1),
  variants: z.array(layerVariantSchema).min(1),
})

export const centerDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: localizedTextSchema,
  worldSize: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  layers: z.object({
    surface: layerSchema,
    inner: layerSchema,
  }),
  landmarks: z.array(z.object({
    id: z.string().min(1),
    layer: z.enum(['surface', 'inner']),
    title: localizedTextSchema,
    annotation: localizedTextSchema,
    polygon: z.array(pointSchema).min(3),
    anchor: pointSchema,
    contentTarget: z.object({
      type: z.enum(['reader-position', 'note']),
      id: z.string().min(1),
      position: readerPositionSchema.optional(),
    }).optional(),
  })),
  progressStates: z.array(z.object({
    key: z.string().min(1),
    startsAt: readerPositionSchema,
    surfaceVariant: z.string().min(1),
    innerVariant: z.string().min(1),
    unlockedLandmarkIds: z.array(z.string()),
    contextualLandmarkIds: z.array(z.string()).optional(),
  })).min(1),
})

export const centerPackageManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9:._-]*$/),
  version: z.string().min(1),
  title: localizedTextSchema,
  centerDefinitionPath: z.string().min(1),
  assets: z.array(z.object({
    id: z.string().min(1),
    path: z.string().min(1),
    mimeType: z.string().min(1),
  })).default([]),
})
