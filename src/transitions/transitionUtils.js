export function createTimerRegistry() {
  const timers = new Set()
  return {
    add(fn, delay) {
      const id = setTimeout(() => {
        timers.delete(id)
        fn()
      }, delay)
      timers.add(id)
      return id
    },
    clear(id) {
      if (timers.has(id)) {
        clearTimeout(id)
        timers.delete(id)
      }
    },
    clearAll() {
      timers.forEach(clearTimeout)
      timers.clear()
    },
  }
}
