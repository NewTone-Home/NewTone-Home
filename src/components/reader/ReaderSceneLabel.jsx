import { memo } from 'react'

function ReaderSceneLabel({ phaseId, scene }) {
  return (
    <div className="reader-scene-label" aria-label={`当前阶段 ${phaseId}`}>
      <span>{phaseId}</span>
      <span aria-hidden="true">·</span>
      <span>{scene.label}</span>
    </div>
  )
}

export default memo(ReaderSceneLabel, (previous, next) => (
  previous.phaseId === next.phaseId
  && previous.scene.id === next.scene.id
  && previous.scene.label === next.scene.label
))
