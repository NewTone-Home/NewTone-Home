import { mainlineReadingOcclusionFadeWorldPx, type MainlineReadingOcclusionRect } from './mainlineReadingOcclusion'
import { mainlineReadingFadeTransitionMs } from './mainlineTextReading'

type Props = {
  id: string
  readingRect: MainlineReadingOcclusionRect
  region: MainlineReadingOcclusionRect
  active: boolean
  fadeWidthWorldPx?: number
}

/** One shared world-space mask definition; full-world visual layers reference it. */
export function MainlineReadingOcclusionMask({ id, readingRect, region, active, fadeWidthWorldPx = mainlineReadingOcclusionFadeWorldPx }: Props) {
  const { x, y, width, height } = readingRect
  const right = x + width
  const bottom = y + height
  const fade = Math.max(.01, fadeWidthWorldPx)
  const whiteToBlack = <><stop offset="0" stopColor="white"/><stop offset="1" stopColor="black"/></>
  const blackToWhite = <><stop offset="0" stopColor="black"/><stop offset="1" stopColor="white"/></>
  const radialGradient = (name: string, cx: number, cy: number) => (
    <radialGradient key={name} id={`${id}-${name}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={fade}>
      <stop offset="0" stopColor="black"/><stop offset="1" stopColor="white"/>
    </radialGradient>
  )

  return <svg className="scene-reading-occlusion-defs" aria-hidden="true" width="1" height="1" focusable="false">
    <defs>
      <linearGradient id={`${id}-top`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y - fade} y2={y}>{whiteToBlack}</linearGradient>
      <linearGradient id={`${id}-bottom`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={bottom} y2={bottom + fade}>{blackToWhite}</linearGradient>
      <linearGradient id={`${id}-left`} gradientUnits="userSpaceOnUse" x1={x - fade} x2={x} y1="0" y2="0">{whiteToBlack}</linearGradient>
      <linearGradient id={`${id}-right`} gradientUnits="userSpaceOnUse" x1={right} x2={right + fade} y1="0" y2="0">{blackToWhite}</linearGradient>
      {radialGradient('top-left', x, y)}{radialGradient('top-right', right, y)}
      {radialGradient('bottom-left', x, bottom)}{radialGradient('bottom-right', right, bottom)}
      <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="luminance" x={region.x} y={region.y} width={region.width} height={region.height} data-reading-mask-feather-world-px={fade}>
        <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white"/>
        <g className="scene-reading-occlusion-mask-shape" style={{ opacity: active ? 1 : 0, transition: `opacity ${mainlineReadingFadeTransitionMs}ms linear` }} data-reading-mask-progress={active ? '1' : '0'}>
          <rect x={x} y={y} width={width} height={height} fill="black" data-reading-mask-core="true"/>
          {width > 0 && height > 0 && <>
            <rect x={x} y={y - fade} width={width} height={fade} fill={`url(#${id}-top)`}/>
            <rect x={x} y={bottom} width={width} height={fade} fill={`url(#${id}-bottom)`}/>
            <rect x={x - fade} y={y} width={fade} height={height} fill={`url(#${id}-left)`}/>
            <rect x={right} y={y} width={fade} height={height} fill={`url(#${id}-right)`}/>
            <rect x={x - fade} y={y - fade} width={fade} height={fade} fill={`url(#${id}-top-left)`}/>
            <rect x={right} y={y - fade} width={fade} height={fade} fill={`url(#${id}-top-right)`}/>
            <rect x={x - fade} y={bottom} width={fade} height={fade} fill={`url(#${id}-bottom-left)`}/>
            <rect x={right} y={bottom} width={fade} height={fade} fill={`url(#${id}-bottom-right)`}/>
          </>}
        </g>
      </mask>
    </defs>
  </svg>
}
