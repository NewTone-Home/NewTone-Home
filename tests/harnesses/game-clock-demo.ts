import { createGameClock } from '../../src/center/runtime/gameClock'

const gameTimeOutput = document.querySelector<HTMLElement>('#game-time')!
const realTimeOutput = document.querySelector<HTMLElement>('#real-time')!
const multiplierOutput = document.querySelector<HTMLElement>('#multiplier')!
const sceneOutput = document.querySelector<HTMLElement>('#scene')!
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('#modes button')]

let clock = createGameClock({ now: () => performance.now() })
let sessionStartedAt = performance.now()
let scene = 0

function formatDuration(milliseconds: number, showHours: boolean) {
  const totalSeconds = Math.floor(milliseconds / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  return showHours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function render() {
  const snapshot = clock.read()
  gameTimeOutput.textContent = formatDuration(snapshot.gameTimeMs, true)
  realTimeOutput.textContent = formatDuration(performance.now() - sessionStartedAt, false)
  multiplierOutput.textContent = `${snapshot.multiplier}×${snapshot.frozen ? '（已冻结）' : ''}`
  sceneOutput.textContent = scene === 0 ? '街道' : '咖啡店'
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === snapshot.multiplier))
  }
  const paused = snapshot.freezeReasons.includes('demo-pause')
  pauseButton.textContent = paused ? '恢复演示时钟' : '暂停演示时钟'
  pauseButton.setAttribute('aria-pressed', String(paused))
  requestAnimationFrame(render)
}

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    clock.setMultiplier(Number(button.dataset.rate))
    for (const candidate of modeButtons) candidate.setAttribute('aria-pressed', String(candidate === button))
  })
}

pauseButton.addEventListener('click', () => {
  const paused = clock.read().freezeReasons.includes('demo-pause')
  clock.setFrozen('demo-pause', !paused)
})

document.querySelector<HTMLButtonElement>('#scene-change')!.addEventListener('click', () => {
  scene = scene === 0 ? 1 : 0
})

document.querySelector<HTMLButtonElement>('#reopen')!.addEventListener('click', () => {
  // A new in-memory session has no persisted real-time anchor to catch up from.
  clock = createGameClock({ now: () => performance.now() })
  sessionStartedAt = performance.now()
  scene = 0
})

requestAnimationFrame(render)
