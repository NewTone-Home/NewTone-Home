function ReaderSceneLabel({ phaseId, scene }) {
  return (
    <div className="reader-scene-label" aria-label={`当前阶段 ${phaseId}`}>
      <span>{phaseId}</span>
      <span aria-hidden="true">·</span>
      <span>{scene.label}</span>
    </div>
  )
}

export default ReaderSceneLabel
