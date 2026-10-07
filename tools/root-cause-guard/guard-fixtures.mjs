import { test } from 'node:test';
import { tmpdir, homedir } from 'node:os';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_STATE_ROOT } from './root-cause-guard.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const guard = process.env.GUARD_UNDER_TEST || join(base, 'root-cause-guard.mjs');
const fixtures = mkdtempSync(join(tmpdir(), 'root-cause-guard-fixtures-'));
const fixtureGit = process.env.CODEX_GUARD_GIT || (existsSync(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe')) ? join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe') : 'git');
function command(cwd, args) {
  const r = spawnSync(fixtureGit, ['-c', 'user.name=Guard Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr || r.stdout); return r.stdout.trim();
}
function fixture() {
  const top = mkdtempSync(join(fixtures, 'case-')), repo = join(top, 'repo'), state = join(top, 'state');
  mkdirSync(repo); mkdirSync(join(repo, 'tests'));
  writeFileSync(join(repo, 'source.js'), 'export const value = 1;\n');
  writeFileSync(join(repo, 'tests', 'contract.test.js'), 'expect(value).toBe(1);\n');
  command(repo, ['init', '-b', 'main']); command(repo, ['add', '.']); command(repo, ['commit', '-m', 'fixture base']);
  const run = (mode = 'check', cwd = repo) => spawnSync(process.execPath, [guard, mode], { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, CODEX_GUARD_STATE_ROOT: state } });
  const baseline = () => { const r = run('baseline'); assert.equal(r.status, 0, r.stderr); return r.stdout.match(/baseline saved: (.+)/)[1].trim(); };
  return { repo, state, run, baseline, write: (file, text) => writeFileSync(join(repo, file), text) };
}
function reviewPass(f, rule) {
  const r = f.run(); assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /BLOCK: 0/); assert.match(r.stdout, /GUARD PASS WITH REVIEWS/); assert.ok(r.stdout.includes(`[${rule}]`), r.stdout);
  return r;
}
test('1 timer is REVIEW and exit 0', () => { const f = fixture(); f.baseline(); f.write('source.js', 'setTimeout(() => {}, 2000);\n'); reviewPass(f, 'lifecycle-timer'); });
test('2 expect.poll is REVIEW and exit 0', () => { const f = fixture(); f.baseline(); f.write('tests/contract.test.js', 'expect(value).toBe(1);\nawait expect.poll(readState).toBe(true);\n'); reviewPass(f, 'polling'); });
test('3 coordinate is REVIEW and exit 0', () => { const f = fixture(); f.baseline(); f.write('source.js', 'export const point = { x: 12, y: 10 };\n'); reviewPass(f, 'fixed-coordinate'); });
test('4 changed assertion needs no replacement marker', () => { const f = fixture(); f.baseline(); f.write('tests/contract.test.js', 'expect(value).toBe(2);\n'); reviewPass(f, 'test-contract-changed'); });
test('5 missing baseline scans HEAD and untracked without writing state', () => { const f = fixture(); f.write('source.js', 'setTimeout(done, 2000);\n'); f.write('new file.js', 'expect.poll(readState);\n'); const r = reviewPass(f, 'baseline-missing'); assert.match(r.stdout, /\[lifecycle-timer\]/); assert.match(r.stdout, /\[polling\]/); assert.equal(existsSync(f.state), false); });
test('6 changed HEAD falls back and preserves baseline bytes', () => { const f = fixture(); const path = f.baseline(), before = readFileSync(path); f.write('source.js', 'export const value = 2;\n'); command(f.repo, ['add', '.']); command(f.repo, ['commit', '-m', 'fixture HEAD change']); f.write('source.js', 'setTimeout(done, 2000);\n'); const r = reviewPass(f, 'baseline-stale'); assert.match(r.stdout, /HEAD changed/); assert.deepEqual(readFileSync(path), before); });
test('7 clean valid baseline passes with no reviews', () => { const f = fixture(); f.baseline(); const r = f.run(); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /REVIEW: 0/); assert.match(r.stdout, /GUARD PASS/); });
test('8 legacy registry marker and projectRoot mismatch are informational', () => { const f = fixture(); f.write('root-cause-guard.contract-replacements.json', JSON.stringify({ version: 1, replacements: [{ id: 'old', projectRoot: 'old-worktree', testFile: 'tests/contract.test.js', oldContract: 'one', newContract: 'two', requiredAddedAssertions: ['not-added'] }] })); command(f.repo, ['add', '.']); command(f.repo, ['commit', '-m', 'historical registry']); f.baseline(); f.write('tests/contract.test.js', 'expect(value).toBe(3);\n'); const r = reviewPass(f, 'test-contract-changed'); assert.match(r.stdout, /KNOWN HISTORICAL CONTRACT CHANGE/); });
test('9 legacy baseline falls back without overwrite', () => { const f = fixture(); const path = f.baseline(); f.write('source.js', 'setInterval(readState, 1000);\n'); writeFileSync(path, JSON.stringify({ version: 2, tracked: [], untracked: [], contents: {} })); const before = readFileSync(path); reviewPass(f, 'legacy-baseline'); assert.deepEqual(readFileSync(path), before); });
test('10 branch change and 11 expiry are non-blocking', () => { const f = fixture(); let path = f.baseline(); command(f.repo, ['branch', '-m', 'renamed']); reviewPass(f, 'baseline-stale'); path = f.baseline(); const saved = JSON.parse(readFileSync(path)); saved.createdAt = new Date(Date.now() - 8 * 86400000).toISOString(); writeFileSync(path, JSON.stringify(saved)); reviewPass(f, 'baseline-stale'); });
test('12 malformed registry does not fail scanning', () => { const f = fixture(); f.baseline(); f.write('root-cause-guard.contract-replacements.json', '{broken'); reviewPass(f, 'contract-history-unreadable'); });
test('13 pre-existing dirty snapshot detects later changes', () => { const f = fixture(); f.write('source.js', 'export const value = 2;\n'); f.baseline(); assert.match(f.run().stdout, /REVIEW: 0/); f.write('source.js', 'export const value = 2;\nsetTimeout(done, 2000);\n'); reviewPass(f, 'lifecycle-timer'); });
test('14 spaces and Unicode paths are scanned accurately', () => { const f = fixture(); f.baseline(); f.write('中文 file.js', 'const point = { x: 1, y: 2 };\n'); const r = reviewPass(f, 'fixed-coordinate'); assert.match(r.stdout, /中文 file.js/); });
test('15 baseline replacement keeps prior snapshot in history', () => { const f = fixture(); const p = f.baseline(), before = readFileSync(p); f.write('source.js', 'export const value = 2;\n'); f.baseline(); const history = join(dirname(p), 'history'); assert.equal(readdirSync(history).length, 1); assert.deepEqual(readFileSync(join(history, readdirSync(history)[0])), before); });
test('16 internal errors return 2', () => { const f = fixture(); assert.equal(f.run('invalid').status, 2); assert.equal(f.run('check', fixtures).status, 2); });
test('17 explicit internal BLOCK fixture returns 1 with GUARD BLOCKED', () => {
  const expression = `import {printReport} from ${JSON.stringify(pathToFileURL(guard).href)}; process.exitCode=printReport([{level:'BLOCK',path:'internal-fixture',line:1,rule:'explicit-fixture',reason:'high-confidence fixture result'}]);`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', expression], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr); assert.match(r.stdout, /BLOCK: 1/); assert.match(r.stdout, /GUARD BLOCKED/);
});
test('18 default state is canonical persistent root', () => { assert.match(DEFAULT_STATE_ROOT.replaceAll('\\', '/'), /Documents\/Codex\/_persistent_state\/root-cause-guard$/); });
test('19 listener and empty catch are REVIEW', () => { const f = fixture(); f.baseline(); f.write('source.js', 'addEventListener("ready", ready);\ntry { work(); } catch {}\n'); const r = reviewPass(f, 'listener'); assert.match(r.stdout, /\[empty-catch\]/); });
test('20 returning baseline dirty file to clean is still reviewed', () => { const f = fixture(); f.write('tests/contract.test.js', 'expect(value).toBe(2);\n'); f.baseline(); f.write('tests/contract.test.js', 'expect(value).toBe(1);\n'); reviewPass(f, 'test-contract-changed'); });
