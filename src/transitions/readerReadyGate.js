export function createReadyGate() {
  let fired = false
  return {
    call(fn) {
      if (fired) return
      fired = true
      fn()
    },
    reset() {
      fired = false
    },
  }
}
