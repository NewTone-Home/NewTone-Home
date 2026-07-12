import './LandingSketchLayer.css'

function GuideLines() {
  return (
    <g className="sketch-guides-layer">
      <path className="sketch-guide-h" d="M 30,160 L 1410,160" />
      <path className="sketch-guide-h" d="M 30,300 L 1410,300" />
      <path className="sketch-guide-h" d="M 30,560 L 1410,560" />
      <path className="sketch-guide-h" d="M 30,720 L 1410,720" />
      <path className="sketch-guide-v" d="M 720,30 L 720,870" />
      <path className="sketch-guide-v sketch-guide-v--offset" d="M 724,30 L 724,870" />
    </g>
  )
}

function Archway({ phase }) {
  return (
    <g className="sketch-archway-layer">
      <path className="sketch-arch-pillar sketch-draw" pathLength="1" d="M 80,680 L 80,280" />
      <path className="sketch-arch-pillar-faint" d="M 84,680 L 84,280" />
      <path className="sketch-arch-pillar sketch-draw" pathLength="1" d="M 220,680 L 220,280" style={{ animationDelay: '0.1s' }} />
      <path className="sketch-arch-top sketch-draw" pathLength="1" d="M 80,280 Q 95,170 150,170" style={{ animationDelay: '0.2s' }} />
      <path className="sketch-arch-top-faint" d="M 220,280 Q 205,170 150,170" />
      <path className="sketch-arch-base sketch-draw" pathLength="1" d="M 60,680 L 240,680" style={{ animationDelay: '0.15s' }} />
      <path className="sketch-arch-base-faint" d="M 62,682 L 238,682" />
      <path className="sketch-tick" d="M 80,280 L 60,280 M 80,400 L 60,400 M 80,550 L 60,550" />
      <path className="sketch-tick" d="M 220,280 L 240,280 M 220,400 L 240,400 M 220,550 L 240,550" />

      {phase >= 1 && (
        <g className="sketch-arch-phase1">
          <path className="sketch-arch-construction sketch-draw" pathLength="1" d="M 80,280 L 220,280" style={{ animationDelay: '0ms' }} />
          <path className="sketch-arch-construction" d="M 80,480 L 220,480" />
          <path className="sketch-arch-diagonal" d="M 80,280 L 220,680" />
          <path className="sketch-arch-diagonal" d="M 220,280 L 80,680" />
        </g>
      )}

      {phase >= 2 && (
        <g className="sketch-arch-phase2">
          <path className="sketch-arch-top-complete sketch-draw" pathLength="1" d="M 220,280 Q 205,170 150,170" style={{ animationDelay: '0.1s' }} />
          <path className="sketch-arch-keystone" d="M 145,165 L 155,165 L 155,180 L 145,180 Z" />
          <path className="sketch-arch-ground" d="M 40,680 L 260,680" />
        </g>
      )}
    </g>
  )
}

function TitleCircle({ retraceKey }) {
  return (
    <g className="sketch-title-circle-layer">
      <ellipse className="sketch-title-circle sketch-draw" pathLength="1" cx="720" cy="432" rx="210" ry="95" />
      <ellipse className="sketch-title-circle-faint" cx="720" cy="432" rx="214" ry="98" />
      <path className="sketch-crosshair" d="M 720,332 L 720,532 M 610,432 L 830,432" />
      {retraceKey > 0 && (
        <ellipse
          key={retraceKey}
          className="sketch-title-circle-echo"
          cx="720" cy="432" rx="210" ry="95"
        />
      )}
    </g>
  )
}



function EraserMarks() {
  return (
    <g className="sketch-eraser-layer">
      <path className="sketch-eraser" d="M 260,410 Q 290,405 310,415 Q 330,408 350,418" />
      <path className="sketch-eraser" d="M 1130,370 Q 1150,365 1170,375 Q 1160,380 1140,372" />
      <path className="sketch-eraser" d="M 540,460 Q 560,455 575,462" />
      <path className="sketch-eraser" d="M 380,300 Q 400,295 420,305" />
      <ellipse className="sketch-eraser-blotch" cx="250" cy="420" rx="30" ry="20" />
    </g>
  )
}

function MarginBracket() {
  return (
    <g className="sketch-bracket-layer">
      <path className="sketch-bracket sketch-draw" pathLength="1" d="M 1350,320 L 1380,320 L 1380,550 L 1350,550" style={{ animationDelay: '0.8s' }} />
      <path className="sketch-bracket-faint" d="M 1348,322 L 1378,322 L 1378,548 L 1348,548" />
      <path className="sketch-squiggle" d="M 1340,340 Q 1325,345 1330,355" />
      <path className="sketch-squiggle" d="M 1345,530 Q 1330,525 1335,515" />
      <path className="sketch-squiggle" d="M 1335,420 Q 1320,425 1325,435 Q 1330,440 1322,445" />
    </g>
  )
}

function LandingSketchLayer({ titleActivated, archwayPhase = 0, retraceKey = 0 }) {
  return (
    <div className="landing-sketch-layer" aria-hidden="true">
      <svg
        className={`landing-sketch-svg${titleActivated ? ' sketch--activated' : ''}${archwayPhase >= 1 ? ' sketch--arch-progress' : ''}${archwayPhase >= 2 ? ' sketch--arch-complete' : ''}`}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <GuideLines />
        <Archway phase={archwayPhase} />
        <TitleCircle retraceKey={retraceKey} />

        <EraserMarks />
        <MarginBracket />
      </svg>
    </div>
  )
}

export default LandingSketchLayer
