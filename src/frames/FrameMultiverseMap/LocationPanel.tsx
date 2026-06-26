import { AnimatePresence, motion } from "framer-motion"
import type {
	LocalizedString,
	WorldEvent,
	WorldLayer,
	WorldManifestation,
} from "../../types"
import {
	ACTION_HINT_STYLE,
	ACTION_BUTTON_GHOST_STYLE,
	ACTION_BUTTON_STYLE,
	ACTION_TITLE_STYLE,
	BADGE_ROW_STYLE,
	BADGE_STYLE,
	PANEL_META_STYLE,
	PANEL_STYLE,
	PANEL_TEXT_STYLE,
	PANEL_TITLE_STYLE,
} from "./styles"
import type { VisibleAnchor } from "./types"

type LocationPanelProps = {
	layer: WorldLayer
	selected?: VisibleAnchor
	events: WorldEvent[]
	localize: (value: LocalizedString) => string
	onPrimaryAction: () => void
}

function eventTypeLabel(type: WorldEvent["type"]) {
	if (type === "main") return "主线事件"
	if (type === "side") return "支线事件"
	return "番外事件"
}

function manifestationTypeLabel(type: WorldManifestation["type"]) {
	if (type === "hub" || type === "main-hub") return "主线锚点"
	if (type === "anomaly") return "异常信号"
	if (type === "extra") return "番外事件"
	if (type === "main") return "主线"
	if (type === "side") return "支线"
	return "未知区域"
}

function statusLabel(status: string) {
	if (status === "available") return "已开放"
	if (status === "unstable") return "信号不稳定"
	if (status === "hidden") return "隐藏"
	return "暂未开放"
}

export function LocationPanel({
	layer,
	selected,
	events,
	localize,
	onPrimaryAction,
}: LocationPanelProps) {
	const primaryEvent = events.find((event) => event.status === "available")
	const primaryLabel =
		selected?.manifestation.action === "switchLayer"
			? "查看另一面"
			: primaryEvent
				? localize(primaryEvent.entryLabel)
				: "暂未开放"
	const isUnderside = layer.id === "underside"
	const panelKey = `${layer.id}-${selected?.manifestation.id ?? "empty"}`

	return (
		<aside className="location-hud-panel" style={PANEL_STYLE} aria-live="polite">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={panelKey}
					className="location-panel-readout"
					initial={{ opacity: 0, y: 5 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -3 }}
					transition={{ duration: 0.18, ease: "easeOut" }}
				>
					<p style={PANEL_META_STYLE}>{localize(layer.label)} / 地图情报</p>
					<motion.h2
						style={PANEL_TITLE_STYLE}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.04, duration: 0.16 }}
					>
						{selected
							? localize(selected.manifestation.title)
							: localize(layer.label)}
					</motion.h2>
					<div style={BADGE_ROW_STYLE}>
						<span style={BADGE_STYLE}>所属层：{localize(layer.label)}</span>
						{selected && (
							<>
								<span style={BADGE_STYLE}>
									类型：{manifestationTypeLabel(selected.manifestation.type)}
								</span>
								<span style={BADGE_STYLE}>
									状态：{statusLabel(selected.manifestation.status)}
								</span>
							</>
						)}
					</div>
					<p style={PANEL_TEXT_STYLE}>
						{selected?.manifestation.description
							? localize(selected.manifestation.description)
							: layer.description
								? localize(layer.description)
								: ""}
					</p>
					{primaryEvent && (
						<p style={PANEL_TEXT_STYLE}>
							{eventTypeLabel(primaryEvent.type)} /{" "}
							{statusLabel(primaryEvent.status)}
						</p>
					)}
					<motion.button
						type="button"
						style={{
							...ACTION_BUTTON_STYLE,
							...(isUnderside ? ACTION_BUTTON_GHOST_STYLE : null),
						}}
						onClick={onPrimaryAction}
						disabled={
							!selected ||
							(selected.manifestation.action !== "switchLayer" &&
								!primaryEvent)
						}
						initial={{ opacity: 0, y: 3 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.07, duration: 0.16 }}
					>
						<span style={ACTION_TITLE_STYLE}>{primaryLabel}</span>
						<span style={ACTION_HINT_STYLE}>
							{selected?.anchor.id === "old-crossing" &&
							selected.manifestation.action === "switchLayer"
								? "同一坐标将在里世界显现"
								: selected?.manifestation.id === "ghost-market"
									? "进入鬼市番外事件"
									: "当前入口未开放"}
						</span>
					</motion.button>
				</motion.div>
			</AnimatePresence>
		</aside>
	)
}
