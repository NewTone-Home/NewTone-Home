import { useEffect } from "react"
import { useEntryStore } from "../store"
import { Frame1Logo } from "../frames/Frame1Logo"
import { Placeholder } from "../frames/Placeholder"
import { ErrorBoundary } from "./ErrorBoundary"
import { HeartbeatDot } from "./HeartbeatDot"
import { DevResetButton } from "./DevResetButton"
import { useT } from "../i18n"

// AppShell：根据 destination.kind 路由到对应 frame
// + 全局配饰（HeartbeatDot, DevResetButton）
// + 错误边界
export function AppShell() {
	const init = useEntryStore((s) => s.init)
	const destination = useEntryStore((s) => s.destination)
	const tr = useT()

	useEffect(() => {
		init()
	}, [init])

	// destination 在 init() 完成后才有值
	if (!destination) return null

	return (
		<ErrorBoundary>
			{destination.kind === "full_logo" && <Frame1Logo variant="full" />}
			{destination.kind === "transient_logo" && (
				<Frame1Logo variant="transient" transientNext={destination.next} />
			)}
			{destination.kind === "world_hall" && (
				<Placeholder
					label={tr.placeholder.worldHall}
					hint={tr.placeholder.worldHallHintTemplate.replace(
						"{worldId}",
						destination.worldId,
					)}
				/>
			)}
			{destination.kind === "multiverse" && (
				<Placeholder
					label={tr.placeholder.multiverse}
					hint={tr.placeholder.multiverseHint}
				/>
			)}
			<HeartbeatDot />
			<DevResetButton />
		</ErrorBoundary>
	)
}
