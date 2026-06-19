import { useEffect } from "react"
import { useEntryStore } from "../store/useEntryStore"
import { useT } from "../i18n"
import { ErrorBoundary } from "./ErrorBoundary"
import { Frame1Logo } from "../frames/Frame1Logo"
import { Frame2WorldHall } from "../frames/Frame2WorldHall"
import { Frame3Chapter } from "../frames/Frame3Chapter"
import { Placeholder } from "../frames/Placeholder"
import { HeartbeatDot } from "./HeartbeatDot"
import { DevResetButton } from "./DevResetButton"
import { DevChapterButton } from "./DevChapterButton"

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
			{destination.kind === "chapter" && (
				<Frame3Chapter chapterId={destination.chapterId} />
			)}
			<HeartbeatDot />
			<DevResetButton />
			<DevChapterButton />
		</ErrorBoundary>
	)
}
