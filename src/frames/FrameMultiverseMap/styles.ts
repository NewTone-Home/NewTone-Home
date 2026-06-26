import type { CSSProperties } from "react"

export const CONTAINER_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 0,
	overflow: "hidden",
	background:
		"radial-gradient(circle at 50% 35%, #18232c 0, transparent 32%), linear-gradient(145deg, #06080c 0%, #0b1118 48%, #07070a 100%)",
	color: "#e8f2f3",
	fontFamily: "inherit",
}

export const SHELL_STYLE: CSSProperties = {
	position: "relative",
	width: "100vw",
	minHeight: "100vh",
	overflow: "hidden",
}

export const HEADER_STYLE: CSSProperties = {
	position: "absolute",
	left: 40,
	top: 32,
	width: "min(480px, calc(100vw - 640px))",
	zIndex: 20,
	pointerEvents: "none",
}

export const KICKER_STYLE: CSSProperties = {
	margin: "0 0 8px",
	fontSize: 10,
	letterSpacing: 0,
	color: "rgba(198, 222, 233, 0.52)",
	textTransform: "uppercase",
}

export const TITLE_STYLE: CSSProperties = {
	margin: 0,
	fontSize: "clamp(21px, 1.75vw, 28px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.12,
	color: "#f1f7f8",
	whiteSpace: "nowrap",
}

export const SUBTITLE_STYLE: CSSProperties = {
	margin: "10px 0 0",
	fontSize: 12,
	fontWeight: 300,
	lineHeight: 1.62,
	color: "rgba(218, 230, 232, 0.66)",
}

export const OBJECTIVE_STYLE: CSSProperties = {
	display: "inline-grid",
	gap: 4,
	marginTop: 15,
	padding: "8px 10px",
	border: "1px solid rgba(178, 210, 224, 0.11)",
	borderRadius: 6,
	background: "rgba(5, 10, 15, 0.32)",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
	backdropFilter: "blur(12px)",
	color: "rgba(224, 238, 241, 0.74)",
	fontSize: 11,
	fontWeight: 300,
	lineHeight: 1.38,
}

export const OBJECTIVE_LINE_STYLE: CSSProperties = {
	display: "block",
	whiteSpace: "nowrap",
}

export const SCENE_STAGE_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	width: "100vw",
	minHeight: "100vh",
	border: 0,
	borderRadius: 0,
	overflow: "hidden",
	background: "#080d12",
	boxShadow:
		"inset 0 0 0 1px rgba(255,255,255,0.018), inset 0 -180px 240px rgba(0,0,0,0.52)",
	perspective: 900,
}

export const SCENE_BACKDROP_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	overflow: "hidden",
	pointerEvents: "none",
}

export const SCENE_BACKDROP_IMAGE_STYLE: CSSProperties = {
	position: "absolute",
	inset: "-9%",
	width: "118%",
	height: "118%",
	objectFit: "cover",
	objectPosition: "center",
	opacity: 0.38,
	filter: "blur(28px) brightness(0.42) saturate(0.62)",
	transform: "scale(1.08)",
}

export const SCENE_BACKDROP_VEIL_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	background:
		"radial-gradient(ellipse at 50% 48%, rgba(12, 24, 31, 0.08), rgba(2, 5, 8, 0.5) 58%, rgba(1, 3, 6, 0.86) 100%), linear-gradient(90deg, rgba(2,5,8,0.72), transparent 22%, transparent 78%, rgba(2,5,8,0.72))",
}

export const MAP_VIEWPORT_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	display: "grid",
	placeItems: "center",
	overflow: "hidden",
}

export const MAP_CANVAS_STYLE: CSSProperties = {
	position: "relative",
	aspectRatio: "3 / 2",
	width: "min(94vw, calc(100vh * 1.5))",
	height: "min(94vh, calc(100vw / 1.5))",
	overflow: "hidden",
	filter: "saturate(0.75) brightness(0.78) contrast(1.04)",
	boxShadow: "none",
}

export const MAP_CANVAS_VIGNETTE_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	background:
		"radial-gradient(circle at 50% 50%, rgba(205,229,232,0.07) 0 16%, transparent 17% 31%, rgba(175,213,224,0.06) 32%, transparent 33% 44%, rgba(2, 6, 10, 0.2) 62%, rgba(2, 5, 8, 0.72) 78%, rgba(2, 5, 8, 0.96) 94%, rgba(2, 5, 8, 1) 100%)",
	boxShadow: "inset 0 0 150px rgba(1, 5, 8, 0.86)",
	zIndex: 8,
}

export const MAP_CANVAS_CORNER_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	background:
		"radial-gradient(circle at 50% 50%, transparent 0 42%, rgba(160,205,218,0.07) 42.2%, transparent 42.6% 55%, rgba(140,185,202,0.04) 55.2%, transparent 55.7% 66%, rgba(1,4,7,0.58) 78%, rgba(1,3,6,0.98) 100%), linear-gradient(90deg, rgba(1,3,6,0.98), rgba(1,3,6,0.64) 8%, transparent 24%, transparent 76%, rgba(1,3,6,0.64) 92%, rgba(1,3,6,0.98)), linear-gradient(180deg, rgba(1,3,6,0.98), rgba(1,3,6,0.58) 9%, transparent 25%, transparent 75%, rgba(1,3,6,0.58) 91%, rgba(1,3,6,0.98))",
	zIndex: 9,
}

export const MAP_CANVAS_DISK_GLOW_STYLE: CSSProperties = {
	position: "absolute",
	inset: "3%",
	pointerEvents: "none",
	borderRadius: "50%",
	background:
		"radial-gradient(circle at 50% 50%, rgba(166, 213, 224, 0.12), transparent 20%, transparent 54%, rgba(126, 174, 190, 0.045) 55%, transparent 62%)",
	boxShadow:
		"0 0 0 1px rgba(173, 218, 230, 0.045), 0 0 70px rgba(25, 54, 70, 0.28)",
	zIndex: 7,
}

export const LAYER_FRAME_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	transform: "rotateX(0deg) translateZ(0)",
	transformOrigin: "50% 60%",
	transition: "opacity 620ms ease, transform 620ms ease, filter 620ms ease",
}

export const LAYER_FRAME_UNDERSIDE_STYLE: CSSProperties = {
	filter: "saturate(0.96) contrast(0.92) brightness(0.78)",
	transform: "rotateX(0deg) translate3d(6px, -4px, 0)",
}

export const ASSET_LAYER_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	backgroundPosition: "center",
	backgroundSize: "100% 100%",
	backgroundRepeat: "no-repeat",
	pointerEvents: "none",
	transition: "opacity 460ms ease, transform 460ms ease, filter 460ms ease",
	maskImage:
		"radial-gradient(ellipse at 50% 50%, black 0 56%, rgba(0,0,0,0.86) 66%, rgba(0,0,0,0.28) 82%, transparent 98%)",
	WebkitMaskImage:
		"radial-gradient(ellipse at 50% 50%, black 0 56%, rgba(0,0,0,0.86) 66%, rgba(0,0,0,0.28) 82%, transparent 98%)",
}

export const ANCHOR_OVERLAY_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	zIndex: 10,
}

export const ASSET_IMAGE_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	width: "100%",
	height: "100%",
	objectFit: "fill",
	objectPosition: "center",
}

export const ASSET_BASE_SURFACE_STYLE: CSSProperties = {
	background:
		"radial-gradient(ellipse at 50% 48%, rgba(42, 66, 78, 0.82), transparent 58%), linear-gradient(145deg, rgba(18, 30, 39, 0.99), rgba(6, 10, 16, 1))",
	opacity: 0.98,
}

export const ASSET_BASE_UNDERSIDE_STYLE: CSSProperties = {
	background:
		"radial-gradient(ellipse at 55% 52%, rgba(48, 30, 72, 0.82), transparent 60%), linear-gradient(145deg, rgba(15, 11, 24, 1), rgba(6, 7, 11, 1))",
	opacity: 0.82,
}

export const ASSET_DETAIL_SURFACE_STYLE: CSSProperties = {
	opacity: 0.88,
	backgroundImage:
		"repeating-linear-gradient(28deg, transparent 0 36px, rgba(154,190,203,0.055) 37px, transparent 39px), repeating-linear-gradient(116deg, transparent 0 54px, rgba(154,190,203,0.045) 55px, transparent 57px), radial-gradient(ellipse at 50% 49%, transparent 0 34%, rgba(176,211,224,0.11) 35%, transparent 36%, transparent 48%, rgba(176,211,224,0.07) 49%, transparent 50%)",
	backgroundSize: "220px 160px, 280px 200px, 100% 100%",
}

export const ASSET_DETAIL_UNDERSIDE_STYLE: CSSProperties = {
	opacity: 0.78,
	transform: "translate(7px, -5px)",
	backgroundImage:
		"repeating-linear-gradient(102deg, transparent 0 46px, rgba(135,101,181,0.1) 47px, transparent 49px), repeating-linear-gradient(24deg, transparent 0 72px, rgba(88,79,145,0.07) 73px, transparent 75px), radial-gradient(ellipse at 51% 49%, transparent 0 32%, rgba(113,86,163,0.13) 33%, transparent 35%, transparent 47%, rgba(75,69,132,0.1) 48%, transparent 50%)",
	backgroundSize: "220px 150px, 300px 220px, 100% 100%",
}

export const ASSET_ATMOSPHERE_SURFACE_STYLE: CSSProperties = {
	opacity: 0.7,
	background:
		"radial-gradient(ellipse at 50% 42%, rgba(92,135,153,0.28), transparent 38%), radial-gradient(circle at 72% 62%, rgba(186,226,255,0.12), transparent 13%), linear-gradient(180deg, rgba(255,255,255,0.026), transparent 20%, rgba(0,0,0,0.32))",
}

export const ASSET_ATMOSPHERE_UNDERSIDE_STYLE: CSSProperties = {
	opacity: 0.96,
	background:
		"radial-gradient(ellipse at 58% 50%, rgba(83,58,128,0.5), transparent 40%), radial-gradient(circle at 67% 61%, rgba(133,92,169,0.26), transparent 15%), repeating-linear-gradient(0deg, rgba(169,143,216,0.018) 0 1px, transparent 1px 5px), linear-gradient(180deg, rgba(96,75,146,0.08), transparent 18%, rgba(0,0,0,0.58))",
}

export const ASSET_INTERACTION_SURFACE_STYLE: CSSProperties = {
	opacity: 0.5,
	background:
		"radial-gradient(circle at 67% 61%, rgba(208,238,255,0.36), transparent 9%), radial-gradient(circle at 50% 44%, rgba(174,214,228,0.18), transparent 13%)",
}

export const ASSET_INTERACTION_UNDERSIDE_STYLE: CSSProperties = {
	opacity: 0.92,
	background:
		"radial-gradient(circle at 67% 61%, rgba(151,107,190,0.4), transparent 11%), radial-gradient(circle at 50% 44%, rgba(82,70,143,0.18), transparent 15%)",
}

export const LAYER_CHIP_STYLE: CSSProperties = {
	position: "absolute",
	right: 40,
	top: 32,
	display: "flex",
	gap: 2,
	padding: 3,
	border: "1px solid rgba(194, 215, 219, 0.08)",
	borderRadius: 999,
	background: "rgba(5, 9, 13, 0.32)",
	backdropFilter: "blur(10px)",
	opacity: 0.54,
	zIndex: 21,
}

export const LAYER_BUTTON_STYLE: CSSProperties = {
	border: 0,
	borderRadius: 999,
	background: "transparent",
	color: "rgba(225, 234, 235, 0.42)",
	cursor: "pointer",
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	padding: "5px 8px",
}

export const LAYER_BUTTON_ACTIVE_STYLE: CSSProperties = {
	background: "rgba(141, 190, 205, 0.08)",
	color: "rgba(238, 248, 248, 0.72)",
}

export const NODE_STYLE: CSSProperties = {
	position: "absolute",
	transform: "translate(-50%, -50%)",
	border: 0,
	background: "transparent",
	color: "#eef8f8",
	cursor: "pointer",
	textAlign: "left",
	padding: 0,
	zIndex: 5,
}

export const NODE_DOT_STYLE: CSSProperties = {
	position: "relative",
	display: "block",
	width: 10,
	height: 10,
	borderRadius: 999,
	background: "rgba(187, 222, 230, 0.78)",
	boxShadow:
		"0 0 0 5px rgba(129,156,166,0.07), 0 0 18px rgba(129,156,166,0.24)",
	transition: "transform 180ms ease, box-shadow 180ms ease",
}

export const NODE_DOT_HUB_STYLE: CSSProperties = {
	width: 26,
	height: 26,
	borderRadius: 999,
	background:
		"radial-gradient(circle, rgba(232,248,250,0.82) 0 14%, rgba(128,178,194,0.42) 15% 38%, transparent 40%), radial-gradient(circle, rgba(128,178,194,0.18), transparent 70%)",
	boxShadow:
		"0 0 0 10px rgba(141, 190, 205, 0.045), 0 0 34px rgba(141,190,205,0.22), inset 0 0 16px rgba(230,248,250,0.14)",
}

export const NODE_DOT_ANOMALY_STYLE: CSSProperties = {
	background: "#dcefff",
	boxShadow:
		"0 0 0 7px rgba(159,216,255,0.11), 0 0 0 16px rgba(159,216,255,0.04), 0 0 28px rgba(171,225,255,0.42)",
}

export const NODE_DOT_GHOST_STYLE: CSSProperties = {
	width: 24,
	height: 24,
	background:
		"radial-gradient(circle, rgba(236,226,255,0.95) 0 20%, rgba(139,104,174,0.78) 21% 46%, rgba(78,43,93,0.64) 47% 100%)",
	boxShadow:
		"0 0 0 8px rgba(116,88,168,0.16), 0 0 0 18px rgba(78,55,124,0.06), 0 0 34px rgba(151,96,178,0.5)",
}

export const NODE_DOT_LOCKED_STYLE: CSSProperties = {
	opacity: 0.45,
	boxShadow: "0 0 0 6px rgba(129,156,166,0.05)",
}

export const NODE_LABEL_STYLE: CSSProperties = {
	position: "absolute",
	left: 34,
	top: "50%",
	transform: "translateY(-50%)",
	minWidth: 132,
	padding: 0,
	borderRadius: 0,
	border: 0,
	background: "transparent",
	textShadow: "0 1px 10px rgba(0,0,0,0.86)",
	backdropFilter: "none",
}

export const NODE_LABEL_HUB_STYLE: CSSProperties = {
	left: 44,
	minWidth: 164,
}

export const NODE_TITLE_STYLE: CSSProperties = {
	display: "block",
	fontSize: 12,
	fontWeight: 300,
	letterSpacing: 0,
	whiteSpace: "nowrap",
}

export const NODE_SUBTITLE_STYLE: CSSProperties = {
	display: "block",
	marginTop: 4,
	fontSize: 10,
	fontWeight: 300,
	letterSpacing: 0,
	color: "rgba(225, 236, 238, 0.58)",
	whiteSpace: "nowrap",
}

export const PANEL_STYLE: CSSProperties = {
	position: "absolute",
	right: 30,
	top: 138,
	width: 282,
	zIndex: 22,
	border: 0,
	borderLeft: "1px solid rgba(181, 219, 231, 0.14)",
	borderRadius: 6,
	padding: "clamp(16px, 2.2vw, 22px)",
	background:
		"linear-gradient(100deg, rgba(3, 7, 11, 0.18), rgba(8, 13, 18, 0.66) 16%, rgba(5, 7, 11, 0.82) 100%)",
	boxShadow:
		"inset 0 1px 0 rgba(255,255,255,0.018), -24px 0 52px rgba(6, 17, 24, 0.22), 0 18px 56px rgba(0,0,0,0.24)",
	backdropFilter: "blur(18px)",
}

export const PANEL_META_STYLE: CSSProperties = {
	margin: "0 0 8px",
	fontSize: 11,
	letterSpacing: 0,
	color: "rgba(198, 222, 233, 0.52)",
}

export const PANEL_TITLE_STYLE: CSSProperties = {
	margin: "0 0 9px",
	fontSize: "clamp(23px, 2.6vw, 31px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.14,
	color: "#f1f7f8",
}

export const PANEL_TEXT_STYLE: CSSProperties = {
	margin: "0 0 18px",
	fontSize: 12,
	fontWeight: 300,
	lineHeight: 1.75,
	color: "rgba(225, 234, 235, 0.68)",
}

export const BADGE_ROW_STYLE: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: 7,
	marginBottom: 16,
}

export const BADGE_STYLE: CSSProperties = {
	border: "1px solid rgba(194, 215, 219, 0.13)",
	borderRadius: 999,
	padding: "5px 9px",
	fontSize: 11,
	fontWeight: 300,
	color: "rgba(225, 236, 238, 0.76)",
}

export const ACTION_BUTTON_STYLE: CSSProperties = {
	width: "100%",
	border: "1px solid rgba(160, 215, 232, 0.34)",
	borderRadius: 6,
	padding: "14px 14px",
	background:
		"linear-gradient(135deg, rgba(112, 174, 202, 0.26), rgba(255,255,255,0.045))",
	color: "#eef8f8",
	cursor: "pointer",
	textAlign: "left",
	boxShadow:
		"inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(71, 138, 171, 0.12)",
}

export const ACTION_BUTTON_GHOST_STYLE: CSSProperties = {
	borderColor: "rgba(159, 124, 205, 0.42)",
	background:
		"linear-gradient(135deg, rgba(88, 58, 133, 0.34), rgba(36, 20, 52, 0.18))",
	boxShadow:
		"inset 0 1px 0 rgba(255,255,255,0.035), 0 12px 34px rgba(99, 69, 153, 0.18)",
}

export const ACTION_TITLE_STYLE: CSSProperties = {
	display: "block",
	fontSize: 14,
	fontWeight: 400,
	letterSpacing: 0,
	lineHeight: 1.2,
	whiteSpace: "nowrap",
}

export const ACTION_HINT_STYLE: CSSProperties = {
	display: "block",
	marginTop: 6,
	fontSize: 10,
	fontWeight: 300,
	letterSpacing: 0,
	color: "rgba(225, 236, 238, 0.62)",
	whiteSpace: "nowrap",
}
