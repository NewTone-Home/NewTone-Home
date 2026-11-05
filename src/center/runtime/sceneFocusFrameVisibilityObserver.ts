type VisibilityListener = () => void

export function sceneFocusFrameVisibilityChanged(previous: string | undefined, next: string) {
  return previous !== undefined && previous !== next
}

/** Return only currently hidden ancestors, stopping at the supplied root. */
export function sceneFocusFrameHiddenAncestors(
  roots: readonly HTMLElement[],
  stopAt: HTMLElement,
  visibilityOf: (element: HTMLElement) => string,
) {
  const hidden = new Set<HTMLElement>()
  roots.forEach((root) => {
    let current: HTMLElement | null = root
    while (current) {
      if (visibilityOf(current) === 'hidden') hidden.add(current)
      if (current === stopAt) break
      current = current.parentElement
    }
  })
  return [...hidden]
}

/**
 * Watches only ancestors that are currently hiding measured glyphs. A visibility
 * class/style change or the end of a discrete visibility transition requests a
 * fresh measurement; it does not poll or make hidden glyphs measurable.
 */
export function createSceneFocusFrameVisibilityObserver(onVisibilityChange: VisibilityListener) {
  const observed = new WeakSet<HTMLElement>()
  const previousVisibility = new WeakMap<HTMLElement, string>()
  const transitionListeners = new Map<HTMLElement, EventListener>()
  const observer = new MutationObserver((records) => {
    let changed = false
    records.forEach(({ target }) => {
      if (!(target instanceof HTMLElement)) return
      const next = getComputedStyle(target).visibility
      const previous = previousVisibility.get(target)
      previousVisibility.set(target, next)
      if (sceneFocusFrameVisibilityChanged(previous, next)) changed = true
    })
    if (changed) onVisibilityChange()
  })

  return {
    observeHiddenAncestors(roots: readonly HTMLElement[], stopAt: HTMLElement) {
      const hiddenAncestors = sceneFocusFrameHiddenAncestors(roots, stopAt, element => getComputedStyle(element).visibility)
      hiddenAncestors.forEach((observedElement) => {
        if (observed.has(observedElement)) return
        observed.add(observedElement)
        previousVisibility.set(observedElement, 'hidden')
        observer.observe(observedElement, { attributes: true, attributeFilter: ['class', 'style'] })
        const listener: EventListener = (event) => {
          const next = getComputedStyle(observedElement).visibility
          if ((event as TransitionEvent).propertyName === 'visibility'
            && sceneFocusFrameVisibilityChanged(previousVisibility.get(observedElement), next)) {
            previousVisibility.set(observedElement, next)
            onVisibilityChange()
          }
        }
        observedElement.addEventListener('transitionend', listener)
        transitionListeners.set(observedElement, listener)
      })
    },
    dispose() {
      observer.disconnect()
      transitionListeners.forEach((listener, element) => element.removeEventListener('transitionend', listener))
      transitionListeners.clear()
    },
  }
}
