import { expect, test, vi } from 'vitest';
import { createJournalStorage, memoryStorage, JOURNAL } from '../src/save-session.mjs';
import { createPlayerStoryCheckpointObserver, storyCheckpointTransitions } from '../src/services/playerStoryCheckpoints.mjs';
import { initialCommercialCafeStoryState, commercialCafeNarrativeStarted, commercialCafeStoryReadyToLeave, commercialCafeStoryCompleted, commercialCafeStoryStatePatch } from '../src/center/runtime/commercialCafeStory.ts';

const PLAYER = 'newtone-player-save-v1';
const values = (cafe = {}, reader = {}, narrative = {}) => ({
  [PLAYER]: JSON.stringify({ sceneState: { 'commercial-street': cafe } }),
  'newtone-progress-v4': JSON.stringify({ _version: 4, ...reader }),
  'newtone-narrative-progress-v2': JSON.stringify({ _version: 2, ...narrative }),
});
const cafeValues = story => values(commercialCafeStoryStatePatch(story));
const event = (storyId, kind) => ({ storyId, kind });

test('real Cafe transitions checkpoint start and narrative end, not coffee or later departure', () => {
  const initial = initialCommercialCafeStoryState();
  const active = commercialCafeNarrativeStarted(initial);
  const ended = commercialCafeStoryReadyToLeave(active);
  expect(storyCheckpointTransitions(cafeValues(initial), cafeValues(active))).toEqual([event('center:lao-zhou-cafe', 'started')]);
  expect(storyCheckpointTransitions(cafeValues(active), cafeValues({ ...active, narrativeCursor: 5, coffeeStatus: 'delivered' }))).toEqual([]);
  expect(storyCheckpointTransitions(cafeValues(active), cafeValues(ended))).toEqual([event('center:lao-zhou-cafe', 'completed')]);
  expect(storyCheckpointTransitions(cafeValues(ended), cafeValues(commercialCafeStoryCompleted(ended, 100)))).toEqual([]);
});

test('seat guidance, motion, balances, and resumed dialogue cursors do not create boundaries', () => {
  const before = values({ commercialCafeNarrativePhase: 'dialogue', commercialCafeNarrativeCursor: 5 });
  const after = values({ commercialCafeNarrativePhase: 'dialogue', commercialCafeNarrativeCursor: 0, laoZhouConversationTriggered: true });
  expect(storyCheckpointTransitions(before, after)).toEqual([]);
  expect(storyCheckpointTransitions(values(), values({ laoZhouConversationTriggered: true }))).toEqual([]);
});

test('Ruoyu start/finish checkpoint once; each dialogue line does not', () => {
  const start = values({ commercialCafeRuoyuMeetingStatus: 'in-progress', commercialCafeRuoyuMeetingCursor: 0 });
  expect(storyCheckpointTransitions(values(), start)).toEqual([event('center:ruoyu-cafe', 'started')]);
  expect(storyCheckpointTransitions(start, values({ commercialCafeRuoyuMeetingStatus: 'in-progress', commercialCafeRuoyuMeetingCursor: 8 }))).toEqual([]);
  expect(storyCheckpointTransitions(start, values({ commercialCafeRuoyuMeetingStatus: 'complete' }))).toEqual([event('center:ruoyu-cafe', 'completed')]);
});

test('Reader starts/completes on durable flags, not reading position or view', () => {
  const started = values({}, { readerStarted: true, readerCompleted: false });
  expect(storyCheckpointTransitions(values(), started)).toEqual([event('reader:main', 'started')]);
  expect(storyCheckpointTransitions(started, values({}, { readerStarted: true, currentView: 'reader', readerScrollOffset: 200 }))).toEqual([]);
  expect(storyCheckpointTransitions(started, values({}, { readerStarted: true, readerCompleted: true }))).toEqual([event('reader:main', 'completed')]);
});

test('authored Reader events use in-flight/completed identities and batch a handoff', () => {
  const chapter = (inFlightEvent, completedEvents = []) => ({ chapters: { chapter1: { inFlightEvent, completedEvents } } });
  const first = values({}, {}, chapter({ eventId: 'meeting' }));
  expect(storyCheckpointTransitions(values(), first)).toEqual([event('reader:chapter1:meeting', 'started')]);
  const next = values({}, {}, chapter({ eventId: 'departure' }, ['meeting', 'meeting']));
  expect(storyCheckpointTransitions(first, next)).toEqual([event('reader:chapter1:departure', 'started'), event('reader:chapter1:meeting', 'completed')]);
  expect(storyCheckpointTransitions(next, next)).toEqual([]);
});

test('opening an already progressed save never replays history; retained input is parsed, not referenced', () => {
  const checkpoint = vi.fn(), current = values({ commercialCafeNarrativePhase: 'dialogue' }, { readerStarted: true });
  const observer = createPlayerStoryCheckpointObserver({ initialValues: current, onCheckpoint: checkpoint });
  expect(checkpoint).not.toHaveBeenCalled();
  expect(observer.committed(current)).toEqual([]);
  current[PLAYER] = values({ commercialCafeStoryStatus: 'ready-to-leave' })[PLAYER];
  expect(observer.committed(current)).toEqual([event('center:lao-zhou-cafe', 'completed')]);
  expect(checkpoint).toHaveBeenCalledTimes(1);
});

test('malformed or unsupported Reader data is not interpreted as story history', () => {
  const invalid = { ...values(), 'newtone-progress-v4': '{invalid', 'newtone-narrative-progress-v2': '{invalid' };
  const after = values({}, { readerStarted: true }, { chapters: { c: { completedEvents: ['x'] } } });
  expect(storyCheckpointTransitions(invalid, after)).toEqual([]);
  expect(storyCheckpointTransitions({ ...values(), 'newtone-progress-v4': '{"_version":999}' }, after).some(x => x.storyId === 'reader:main')).toBe(false);
});

test('disposal and inactive source prevent stale callbacks', () => {
  const callback = vi.fn(); let active = false;
  const observer = createPlayerStoryCheckpointObserver({ initialValues: values(), onCheckpoint: callback, isActive: () => active });
  observer.committed(values({}, { readerStarted: true }));
  active = true; observer.dispose(); observer.committed(values({}, { readerStarted: true }));
  expect(callback).not.toHaveBeenCalled();
});

test('callback rejection cannot invalidate committed progress or become unhandled', async () => {
  const error = Error('cloud failed'), onError = vi.fn();
  const observer = createPlayerStoryCheckpointObserver({ initialValues: values(), onCheckpoint: async () => { throw error; }, onError });
  observer.committed(values({}, { readerStarted: true }));
  await Promise.resolve();
  expect(onError).toHaveBeenCalledWith(error);
  expect(observer.committed(values({}, { readerStarted: true }))).toEqual([]);
});

function journalRig() {
  const initialValues = values(), initial = { revision: 0, values: initialValues };
  const raw = memoryStorage({ [JOURNAL]: JSON.stringify(initial) });
  const journal = createJournalStorage(raw, initial, null, () => null);
  const seenRevisions = [];
  const callback = vi.fn(() => { seenRevisions.push(JSON.parse(raw.getItem(JOURNAL)).revision); });
  const observer = createPlayerStoryCheckpointObserver({ initialValues, onCheckpoint: callback });
  const write = cafe => {
    journal.setItem(PLAYER, values(cafe)[PLAYER]);
    journal.afterCommit('story', () => observer.committed({ ...initialValues, [PLAYER]: journal.getItem(PLAYER) }));
  };
  return { raw, journal, observer, callback, write, seenRevisions };
}

test('real journal afterCommit emits only once for an atomic story transaction', () => {
  const r = journalRig();
  r.journal.transaction(() => {
    r.write({ commercialCafeNarrativePhase: 'dialogue' });
    r.write({ commercialCafeNarrativePhase: 'dialogue', commercialCafeRuoyuMeetingStatus: 'in-progress' });
    expect(r.callback).not.toHaveBeenCalled();
  });
  expect(r.callback).toHaveBeenCalledTimes(1);
  expect(r.callback.mock.calls[0][0]).toHaveLength(2);
  expect(r.seenRevisions).toEqual([1]);
});

test('real journal rollback and failed durable write never emit checkpoints', () => {
  const r = journalRig();
  expect(() => r.journal.transaction(() => { r.write({ commercialCafeNarrativePhase: 'dialogue' }); throw Error('rollback'); })).toThrow('rollback');
  expect(r.callback).not.toHaveBeenCalled();
  r.raw.setItem = () => { throw Error('quota'); };
  expect(() => r.journal.transaction(() => r.write({ commercialCafeNarrativePhase: 'dialogue' }))).toThrow('storage-write-failed');
  expect(r.callback).not.toHaveBeenCalled();
});

test('real nested rollback removes its scheduled story notification', () => {
  const r = journalRig();
  r.journal.transaction(() => {
    try { r.journal.transaction(() => { r.write({ commercialCafeNarrativePhase: 'dialogue' }); throw Error('nested'); }); } catch { /* rolled back */ }
    r.journal.setItem('newtone-scene-motion-enabled', 'true');
  });
  expect(r.callback).not.toHaveBeenCalled();
});

test('closing from final publication callback cannot falsely fail a durable transaction', () => {
  const initial = { revision: 0, values: values() }, callback = vi.fn();
  const raw = memoryStorage({ [JOURNAL]: JSON.stringify(initial) });
  const journal = createJournalStorage(raw, initial, null, () => null, () => {}, callback);
  expect(journal.transaction(() => {
    journal.setItem('newtone-scene-motion-enabled', 'true');
    journal.afterCommit('close-source', () => {
      try { journal.stop('source-closed-after-publication'); } catch { /* close acknowledged */ }
    });
    return 'durable-result';
  })).toBe('durable-result');
  expect(JSON.parse(raw.getItem(JOURNAL))).toMatchObject({ revision: 1, values: { 'newtone-scene-motion-enabled': 'true' } });
  expect(journal.isOpen).toBe(false);
  expect(callback).not.toHaveBeenCalled();
});

test.each(['synchronous', 'asynchronous'])('%s journal observer failure cannot falsify commit', async mode => {
  const initial = { revision: 0, values: values() }, error = Error('notification-only-failure');
  const raw = memoryStorage({ [JOURNAL]: JSON.stringify(initial) });
  const callback = vi.fn(mode === 'synchronous' ? () => { throw error; } : async () => { throw error; });
  const journal = createJournalStorage(raw, initial, null, () => null, () => {}, callback);
  expect(journal.transaction(() => {
    journal.setItem('newtone-scene-motion-enabled', 'true');
    return 'durable-result';
  })).toBe('durable-result');
  await Promise.resolve();
  expect(callback).toHaveBeenCalledTimes(1);
  expect(JSON.parse(raw.getItem(JOURNAL))).toMatchObject({ revision: 1, values: { 'newtone-scene-motion-enabled': 'true' } });
  expect(journal.isOpen).toBe(true);
  expect(() => journal.check()).not.toThrow();
});
