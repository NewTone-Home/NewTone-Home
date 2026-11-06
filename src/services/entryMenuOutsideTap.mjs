// An outside short tap dismisses presentation only. Drags/scrolls, cancelled
// pointers, and gestures starting or ending inside the menu are not dismissals.
export function trackOutsideMenuMove(start, move) {
  if (!start || start.pointerId !== move.pointerId) return start
  return { ...start, exceeded: start.exceeded === true || Math.hypot(move.x - start.x, move.y - start.y) > 10 }
}

export function isOutsideMenuTap(start, end) {
  return !!start && start.pointerId === end.pointerId && start.outside && end.outside
    && start.exceeded !== true
    && end.at - start.at >= 0 && end.at - start.at <= 700
    && Math.hypot(end.x - start.x, end.y - start.y) <= 10
}
