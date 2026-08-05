export function createReaderRestoreCoordinator() {
  const readiness = {
    locationRestored: false,
    viewportMeasured: false,
    focusPositioned: false,
  }
  let readyCommitted = false

  return {
    markLocationRestored() {
      readiness.locationRestored = true
    },
    markViewportMeasured() {
      readiness.viewportMeasured = true
    },
    markFocusPositioned() {
      readiness.focusPositioned = true
    },
    commitReady() {
      if (readyCommitted || Object.values(readiness).some(value => !value)) return false
      readyCommitted = true
      return true
    },
  }
}
