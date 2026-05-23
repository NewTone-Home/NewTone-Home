import { useEffect } from "react"
import { useEntryStore } from "./store/useEntryStore"
import { Frame1Logo } from "./frames/Frame1Logo"
import {
  PlaceholderMultiverse,
  PlaceholderWorldHall,
} from "./frames/PlaceholderWorldHall"

export default function App() {
  const destination = useEntryStore((s) => s.destination)
  const init = useEntryStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  switch (destination.kind) {
    case "logo_full":
      return <Frame1Logo variant="full" />
    case "logo_transient":
      return <Frame1Logo variant="transient" transientNext={destination.next} />
    case "world_hall":
      return <PlaceholderWorldHall worldId={destination.worldId} />
    case "multiverse":
      return <PlaceholderMultiverse />
  }
}
