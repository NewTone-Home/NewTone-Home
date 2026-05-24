import type { EntryDestination } from "../../types/destination"
import type { HeartbeatVariant } from "./types"

/**
 * 据 destination.kind 决定心跳点 variant（Canon §13.1 钉 10 画风跟随）
 * - multiverse → deep_space（多元宇宙专属画风）
 * - 其他（full_logo / transient_logo / world_hall）→ ink_bloom（当前世界 = 初墨）
 */
export function useHeartbeatVariant(
	destination: EntryDestination | null,
): HeartbeatVariant {
	if (destination?.kind === "multiverse") return "deep_space"
	return "ink_bloom"
}
