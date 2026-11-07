// Observe committed save values only. These are persisted story boundaries, not
// UI dialogue cursors, analytics milestones, seat guidance, or render events.
const PLAYER = 'newtone-player-save-v1';
const READER = 'newtone-progress-v4';
const NARRATIVE = 'newtone-narrative-progress-v2';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function read(values, key) {
  if (values?.[key] === undefined) return {};
  try { const value = JSON.parse(values[key]); return object(value) ? value : null; }
  catch { return null; }
}
function state(values) {
  const player = read(values, PLAYER), reader = read(values, READER), narrative = read(values, NARRATIVE);
  return {
    // The continuous Cafe lives in commercial-street. The older scene key is
    // read only as a fallback, never counted as a second story.
    cafe: player && (player.sceneState?.['commercial-street'] ?? player.sceneState?.['commercial-cafe'] ?? {}),
    reader: reader && (reader._version === undefined || reader._version === 4) ? reader : null,
    narrative: narrative && (narrative._version === undefined || narrative._version === 2) ? narrative : null,
  };
}
function transitions(before, after) {
  const events = [];
  const add = (storyId, kind) => events.push(Object.freeze({ storyId, kind }));
  if (object(before.cafe) && object(after.cafe)) {
    const old = before.cafe, next = after.cafe;
    const ended = value => ['ready-to-leave', 'complete'].includes(value.commercialCafeStoryStatus)
      || value.commercialCafeNarrativePhase === 'complete';
    if (!ended(old) && !ended(next)
      && [undefined, 'not-started'].includes(old.commercialCafeNarrativePhase)
      && next.commercialCafeNarrativePhase === 'dialogue') add('center:lao-zhou-cafe', 'started');
    if (!ended(old) && ended(next)) add('center:lao-zhou-cafe', 'completed');
    if (![ 'in-progress', 'complete' ].includes(old.commercialCafeRuoyuMeetingStatus)
      && next.commercialCafeRuoyuMeetingStatus === 'in-progress') add('center:ruoyu-cafe', 'started');
    if (old.commercialCafeRuoyuMeetingStatus !== 'complete'
      && next.commercialCafeRuoyuMeetingStatus === 'complete') add('center:ruoyu-cafe', 'completed');
  }
  if (before.reader && after.reader) {
    if (before.reader.readerStarted !== true && after.reader.readerStarted === true) add('reader:main', 'started');
    if (before.reader.readerCompleted !== true && after.reader.readerCompleted === true) add('reader:main', 'completed');
  }
  if (before.narrative && after.narrative) {
    const previous = before.narrative.chapters ?? {}, chapters = after.narrative.chapters ?? {};
    if (object(previous) && object(chapters)) for (const [chapterId, chapter] of Object.entries(chapters)) {
      if (!object(chapter)) continue;
      const old = previous[chapterId] ?? {};
      if (!object(old)) continue;
      const completed = new Set(Array.isArray(old.completedEvents) ? old.completedEvents : []);
      const nextCompleted = new Set(Array.isArray(chapter.completedEvents) ? chapter.completedEvents : []);
      const current = chapter.inFlightEvent?.eventId;
      if (typeof current === 'string' && current.length && current !== old.inFlightEvent?.eventId
        && !completed.has(current) && !nextCompleted.has(current)) add(`reader:${chapterId}:${current}`, 'started');
      for (const id of nextCompleted) if (typeof id === 'string' && id.length && !completed.has(id)) add(`reader:${chapterId}:${id}`, 'completed');
    }
  }
  return Object.freeze(events);
}

export function storyCheckpointTransitions(previousValues, committedValues) {
  return transitions(state(previousValues), state(committedValues));
}

/**
 * Session-local observer. Initialize from the opened journal, then call committed
 * only after successful transaction persistence/publication (including verification).
 * Never call from a validator or attempted setItem. One batch asks for one cloud
 * checkpoint even if the atomic transaction completes/starts several stories.
 * Close/replacement must dispose this observer. Callback failures cannot invalidate
 * already durable game progress; the coordinator owns cloud error/retry handling.
 */
export function createPlayerStoryCheckpointObserver({ initialValues, onCheckpoint, isActive = () => true, onError = () => {} }) {
  if (typeof onCheckpoint !== 'function') throw Error('STORY_CHECKPOINT_CALLBACK_REQUIRED');
  let previous = state(initialValues), disposed = false;
  const report = error => { try { onError(error); } catch { /* reporting cannot damage a committed save */ } };
  return Object.freeze({
    committed(values) {
      if (disposed || !isActive()) return Object.freeze([]);
      const next = state(values), events = transitions(previous, next);
      previous = next;
      if (events.length) {
        try { Promise.resolve(onCheckpoint(events)).catch(report); } catch (error) { report(error); }
      }
      return events;
    },
    dispose() { disposed = true; },
  });
}
