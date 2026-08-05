import './LandingSketchLayer.css'

/* Faint resting strokes left on the sheet — paper, not a measurement grid. */
function PaperTraces() {
  return (
    <g className="sketch-paper-layer">
      <path className="sketch-paper-trace" d="M 268,214 C 470,206 690,219 902,209 C 1000,205 1060,210 1112,206" />
      <path className="sketch-paper-trace sketch-paper-trace--short" d="M 316,706 C 452,712 588,701 700,708" />
    </g>
  )
}

/* Unfinished hand-drawn frames — corners left open, nothing squared off. */
function OpenFrames({ phase }) {
  return (
    <g className="sketch-frame-layer">
      <path className="sketch-frame-stroke" d="M 128,196 C 186,191 246,197 302,190" />
      <path className="sketch-frame-stroke" d="M 121,216 C 117,268 124,322 118,372" />
      <path className="sketch-frame-stroke sketch-frame-stroke--faint" d="M 141,392 C 186,397 226,391 268,396" />

      {phase >= 1 && (
        <g className="sketch-frame-phase1">
          <path className="sketch-frame-stroke sketch-draw" pathLength="1" d="M 1108,596 C 1172,601 1240,594 1302,602" />
          <path className="sketch-frame-stroke sketch-draw" pathLength="1" style={{ animationDelay: '0.12s' }} d="M 1311,586 C 1316,632 1310,682 1317,724" />
          <path className="sketch-frame-stroke sketch-frame-stroke--faint" d="M 1122,738 C 1164,743 1204,737 1242,742" />
          <path className="sketch-frame-stroke sketch-draw" pathLength="1" style={{ animationDelay: '0.24s' }} d="M 1216,236 C 1258,231 1300,237 1341,229" />
          <path className="sketch-frame-stroke sketch-frame-stroke--faint" d="M 1210,251 C 1206,276 1211,300 1206,318" />
        </g>
      )}
    </g>
  )
}

/* Loops that never close — the hand lifted before finishing. */
function OpenLoops({ phase }) {
  if (phase < 1) return null
  return (
    <g className="sketch-loop-layer">
      <path
        className="sketch-open-loop sketch-draw"
        pathLength="1"
        d="M 262,536 C 208,528 182,566 200,604 C 218,642 292,650 330,622 C 356,602 352,570 324,556"
      />
      <path
        className="sketch-open-loop sketch-open-loop--faint sketch-draw"
        pathLength="1"
        style={{ animationDelay: '0.18s' }}
        d="M 1044,300 C 1006,292 986,318 998,344 C 1010,370 1058,376 1080,356"
      />
    </g>
  )
}

/* Loose direction strokes — intent marks, not arrows or crosshairs. */
function DirectionStrokes({ phase }) {
  if (phase < 1) return null
  return (
    <g className="sketch-direction-layer">
      <path className="sketch-direction sketch-draw" pathLength="1" d="M 196,468 C 232,462 260,464 286,458" />
      <path className="sketch-direction sketch-draw" pathLength="1" style={{ animationDelay: '0.1s' }} d="M 1148,432 C 1112,428 1084,432 1058,428" />
      <path className="sketch-direction sketch-direction--faint" d="M 742,168 C 740,140 743,120 738,98" />
      <path className="sketch-direction sketch-direction--faint" d="M 700,760 C 704,790 701,812 706,834" />
    </g>
  )
}

/* Structure afterimage — relations only, deliberately no place, no building. */
function StructureGhost({ phase }) {
  if (phase < 2) return null
  return (
    <g className="sketch-ghost-layer">
      <path className="sketch-ghost-link sketch-draw" pathLength="1" d="M 206,662 C 236,676 250,690 268,700" />
      <path className="sketch-ghost-link sketch-draw" pathLength="1" style={{ animationDelay: '0.1s' }} d="M 268,700 C 292,692 312,682 330,672" />
      <path className="sketch-ghost-link sketch-draw" pathLength="1" style={{ animationDelay: '0.2s' }} d="M 268,700 C 262,720 258,734 250,748" />
      <circle className="sketch-ghost-node" cx="206" cy="662" r="2.6" />
      <circle className="sketch-ghost-node" cx="268" cy="700" r="3" />
      <circle className="sketch-ghost-node" cx="330" cy="672" r="2.2" />
      <circle className="sketch-ghost-node" cx="250" cy="748" r="2.2" />

      <path className="sketch-ghost-link sketch-draw" pathLength="1" style={{ animationDelay: '0.16s' }} d="M 1188,392 C 1214,402 1230,412 1246,420" />
      <path className="sketch-ghost-link sketch-draw" pathLength="1" style={{ animationDelay: '0.28s' }} d="M 1246,420 C 1236,438 1226,452 1214,466" />
      <circle className="sketch-ghost-node" cx="1188" cy="392" r="2.4" />
      <circle className="sketch-ghost-node" cx="1246" cy="420" r="2.8" />
      <circle className="sketch-ghost-node" cx="1214" cy="466" r="2.2" />
    </g>
  )
}

/* An open loop held around the title — drawn twice, never quite aligned. */
function TitleLoop({ retraceKey }) {
  const loop = 'M 962,402 C 954,352 858,322 720,326 C 566,330 480,368 476,432 C 472,500 578,540 726,538 C 858,536 952,504 962,462'
  return (
    <g className="sketch-title-loop-layer">
      <path className="sketch-title-loop sketch-draw" pathLength="1" d={loop} />
      <path
        className="sketch-title-loop-second"
        d="M 956,396 C 944,346 852,316 716,321 C 568,326 474,362 470,436"
      />
      {retraceKey > 0 && (
        <path key={retraceKey} className="sketch-title-loop-echo" pathLength="1" d={loop} />
      )}
    </g>
  )
}

/* Rubbed-out passages — the sheet has been reworked. */
function EraserMarks() {
  return (
    <g className="sketch-eraser-layer">
      <path className="sketch-eraser" d="M 150,388 Q 190,382 222,394 Q 252,386 282,398" />
      <path className="sketch-eraser" d="M 1122,584 Q 1156,578 1188,590 Q 1214,582 1244,594" />
      <path className="sketch-eraser" d="M 486,470 Q 508,464 526,472" />
      <path className="sketch-eraser" d="M 1030,318 Q 1052,312 1072,322" />
      <path className="sketch-eraser" d="M 380,300 Q 400,295 420,305" />
      <ellipse className="sketch-eraser-blotch" cx="238" cy="596" rx="34" ry="22" />
    </g>
  )
}

/* A wavering margin mark, the way a hand brackets a page it is still writing. */
function MarginMark() {
  return (
    <g className="sketch-margin-layer">
      <path
        className="sketch-margin-bracket sketch-draw"
        pathLength="1"
        style={{ animationDelay: '0.7s' }}
        d="M 1352,330 C 1372,326 1378,340 1376,370 C 1372,430 1374,486 1378,528 C 1379,546 1369,553 1354,548"
      />
      <path className="sketch-squiggle" d="M 1338,352 Q 1322,357 1328,367" />
      <path className="sketch-squiggle" d="M 1342,524 Q 1327,519 1333,509" />
    </g>
  )
}

function LandingSketchLayer({ titleActivated, archwayPhase = 0, retraceKey = 0 }) {
  // archwayPhase: 0 resting sheet, 1 the hand starts working, 2 structure surfaces
  const phase = archwayPhase
  return (
    <div className="landing-sketch-layer" aria-hidden="true">
      <svg
        className={`landing-sketch-svg${titleActivated ? ' sketch--activated' : ''}${phase >= 1 ? ' sketch--forming' : ''}${phase >= 2 ? ' sketch--formed' : ''}`}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <PaperTraces />
        <OpenFrames phase={phase} />
        <OpenLoops phase={phase} />
        <DirectionStrokes phase={phase} />
        <StructureGhost phase={phase} />
        <TitleLoop retraceKey={retraceKey} />
        <EraserMarks />
        <MarginMark />
      </svg>
    </div>
  )
}

export default LandingSketchLayer
