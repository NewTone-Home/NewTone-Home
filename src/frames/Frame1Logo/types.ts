import type { EntryDestination } from "../../types"

export type Frame1Phase = "intro" | "awaiting_key" | "ready"

export type Frame1Variant = "full" | "transient"

export type Frame1LogoProps = {
  variant: Frame1Variant
  transientNext?: EntryDestination
}
