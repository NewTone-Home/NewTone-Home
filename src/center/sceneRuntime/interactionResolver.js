export const INTERACTION_TYPES = Object.freeze({
  MOVE: 'move',
  FEEDBACK: 'feedback',
  STORY: 'story',
})

export function getSceneObject(scene, objectId) {
  return scene.objects.find(object => object.id === objectId) ?? null
}

export function resolveSceneInteraction({ scene, objectId, narrativeState }) {
  const object = getSceneObject(scene, objectId)
  if (!object) return { type: INTERACTION_TYPES.FEEDBACK, message: '这里没有可接触的对象。' }

  if (!object.interaction) {
    return {
      type: INTERACTION_TYPES.FEEDBACK,
      objectId,
      message: object.ambientFeedback ?? '它安静地留在原处。',
    }
  }

  const resolution = object.interaction({ narrativeState })
  return {
    ...resolution,
    objectId,
    target: resolution.target ?? object.walkTarget,
  }
}
