import { useEffect } from "react"
import { useEntryStore } from "../store/useEntryStore"
import { useT } from "../i18n"
import { ErrorBoundary } from "./ErrorBoundary"
import { Frame1Logo } from "../frames/Frame1Logo"
import { Frame2WorldHall } from "../frames/Frame2WorldHall"
import { Placeholder } from "../frames/Placeholder"
import { HeartbeatDot } from "./HeartbeatDot"
import { DevResetButton } from "./DevResetButton"

export function AppShell() {
	const init = useEntryStore((s) => s.init)
	const destination = useEntryStore((s) => s.destination)
	const tr = useT()

	useEffect(() => {
		init()
	}, [init])

	if (!destination) return null

	return (
		<ErrorBoundary>
			{destination.kind === "full_logo" && <Frame1Logo variant="full" />}
			{destination.kind === "transient_logo" && (
				<Frame1Logo
					variant="transient"
					transientNext={destination.next}
				/>
			)}
			{destination.kind === "world_hall" && (
				<Frame2WorldHall worldId={destination.worldId} />
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
