#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const DEFAULT_STATE_ROOT = join(process.env.USERPROFILE || homedir(), 'Documents', 'Codex', '_persistent_state', 'root-cause-guard');
const HISTORY_FILE = 'root-cause-guard.contract-replacements.json';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TEST_FILE = /(?:^|[\\/])(?:test|tests|spec|__tests__|e2e)(?:[\\/]|\.)|\.(?:test|spec)\.[^/\\]+$/i;
const ASSERTION = /\b(?:assert|assertEquals|expect|toBe|toEqual|test|it)\b/;
const RULES = [
  { id: 'lifecycle-timer', pattern: /\b(?:setTimeout|setInterval)\s*\(/, reason: 'lifecycle timer introduced; review behavior and cleanup in context' },
  { id: 'polling', pattern: /\b(?:retry|retryAsync|poll|pollUntil)\s*\(/, reason: 'polling or retry introduced; distinguish test waits from product behavior' },
  { id: 'empty-catch', pattern: /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/, reason: 'empty catch introduced; review error handling' },
  { id: 'listener', pattern: /\baddEventListener\s*\(/, reason: 'event listener introduced; review lifecycle ownership and cleanup' },
  { id: 'fixed-coordinate', pattern: /\b(?:left|top|right|bottom|x|y)\s*:\s*-?\d+(?:\.\d+)?\s*[,}]/, reason: 'fixed coordinate introduced; review fixture or authored geometry context' },
];
function hash(value) { return createHash('sha256').update(value).digest('hex').slice(0, 24); }
function canonical(value) { const p = normalize(resolve(value)); return process.platform === 'win32' ? p.toLowerCase() : p; }
const bundledGit = join(process.env.USERPROFILE || homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'native', 'git', 'cmd', 'git.exe');
const GIT_EXECUTABLE = process.env.CODEX_GUARD_GIT || (existsSync(bundledGit) ? bundledGit : 'git');
function git(root, args) {
  const r = spawnSync(GIT_EXECUTABLE, ['--no-optional-locks', '-c', `safe.directory=${root}`, '-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (r.error || r.status !== 0) throw r.error || new Error((r.stderr || r.stdout || `Git exit ${r.status}`).trim());
  return r.stdout;
}
function metadata(cwd) {
  const projectRoot = resolve(git(cwd, ['rev-parse', '--show-toplevel']).trim());
  const gitCommonDir = resolve(projectRoot, git(projectRoot, ['rev-parse', '--git-common-dir']).trim());
  const gitDir = resolve(projectRoot, git(projectRoot, ['rev-parse', '--git-dir']).trim());
  const r = spawnSync(GIT_EXECUTABLE, ['--no-optional-locks', '-c', `safe.directory=${projectRoot}`, 'symbolic-ref', '-q', '--short', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', windowsHide: true });
  if (r.error || ![0, 1].includes(r.status)) throw r.error || new Error(r.stderr || 'Cannot read branch');
  let repository;
  try {
    const origin = git(projectRoot, ['remote', 'get-url', 'origin']).trim();
    const m = origin.match(/^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
    if (m) repository = `${m[1]}/${m[2]}`.toLowerCase();
  } catch { /* Local repositories need not have an origin. */ }
  return { projectRoot, repository: repository ?? `local:${hash(canonical(gitCommonDir))}`, gitCommonDir, gitDir, branch: r.status === 0 ? r.stdout.trim() : null, HEAD: git(projectRoot, ['rev-parse', 'HEAD']).trim() };
}
export function baselinePath(meta, stateRoot = DEFAULT_STATE_ROOT) {
  return join(stateRoot, meta.repository.replace(/[^a-zA-Z0-9_.-]+/g, '--'), hash(canonical(meta.projectRoot) + '\n' + canonical(meta.gitDir)), 'baseline.json');
}
function status(root) {
  const chunks = git(root, ['status', '--porcelain=v1', '-z', '-uall']).split('\0'), tracked = [], untracked = [];
  for (let i = 0; i < chunks.length; i++) {
    const item = chunks[i]; if (!item) continue;
    const code = item.slice(0, 2), path = item.slice(3);
    (code === '??' ? untracked : tracked).push(path);
    if (/[RC]/.test(code)) i++;
  }
  return { tracked: [...new Set(tracked)].sort(), untracked: [...new Set(untracked)].sort() };
}
function content(root, file) {
  const p = join(root, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
function review(rule, reason, path = '—', line = '—') { return { level: 'REVIEW', rule, reason, path, line }; }
function loadBaseline(meta, stateRoot, findings) {
  const key = `${hash(meta.projectRoot)}.json`;
  const candidates = [baselinePath(meta, stateRoot), join(stateRoot, 'state', key), join(stateRoot, 'NewTone-Home', 'state', key), join(tmpdir(), 'codex-root-cause-baselines', 'state', key)];
  const file = candidates.find(existsSync);
  if (!file) { findings.push(review('baseline-missing', 'baseline missing; fallback to current Git HEAD diff and untracked scan')); return null; }
  let saved;
  try { saved = JSON.parse(readFileSync(file, 'utf8')); }
  catch { findings.push(review('baseline-stale', 'baseline unreadable or malformed; fallback without overwriting')); return null; }
  if (saved?.version !== 2 || saved.schema !== 'root-cause-guard-v2' || !saved.contents || !Array.isArray(saved.tracked) || !Array.isArray(saved.untracked)) {
    findings.push(review('legacy-baseline', 'legacy baseline; fallback to current Git HEAD diff and untracked scan')); return null;
  }
  const reasons = [];
  if (typeof saved.projectRoot !== 'string' || typeof saved.gitCommonDir !== 'string' || canonical(saved.projectRoot) !== canonical(meta.projectRoot) || saved.repository !== meta.repository || canonical(saved.gitCommonDir) !== canonical(meta.gitCommonDir) || saved.gitDir !== meta.gitDir) reasons.push('repository/worktree identity changed');
  if (saved.HEAD !== meta.HEAD) reasons.push('HEAD changed');
  if (saved.branch !== meta.branch) reasons.push('branch changed');
  const age = Date.now() - Date.parse(saved.createdAt);
  if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -300000) reasons.push('baseline age invalid or older than seven days');
  if ([...saved.tracked, ...saved.untracked].some(p => typeof p !== 'string' || !Object.hasOwn(saved.contents, p) || !(saved.contents[p] === null || typeof saved.contents[p] === 'string'))) reasons.push('snapshot incomplete');
  if (reasons.length) { findings.push(review('baseline-stale', `baseline stale (${reasons.join('; ')}); fallback without overwriting`)); return null; }
  return saved;
}
function saveBaseline(meta, current, stateRoot) {
  const file = baselinePath(meta, stateRoot); mkdirSync(dirname(file), { recursive: true });
  const contents = Object.fromEntries([...current.tracked, ...current.untracked].map(p => [p, content(meta.projectRoot, p)]));
  if (existsSync(file)) {
    const history = join(dirname(file), 'history'); mkdirSync(history, { recursive: true });
    copyFileSync(file, join(history, `${Date.now()}-${randomUUID()}.json`));
  }
  writeFileSync(file, JSON.stringify({ version: 2, schema: 'root-cause-guard-v2', ...meta, createdAt: new Date().toISOString(), ...current, contents }, null, 2));
  console.log(`[root-cause-guard] baseline saved: ${file}`);
  console.log(`[root-cause-guard] existing dirty tracked: ${current.tracked.length}; untracked: ${current.untracked.length}`);
}
function parseAddedLines(diff) {
  const lines = [];
  let newLine = 0;
  for (const rawLine of diff.split(/\r?\n/)) {
    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (rawLine.startsWith("+++") || rawLine.startsWith("---")) continue;
    if (rawLine.startsWith("+")) {
      lines.push({ line: newLine, text: rawLine.slice(1) });
      newLine += 1;
      continue;
    }
    if (rawLine.startsWith(" ") && newLine > 0) newLine += 1;
  }
  return lines;
}

function diffFromContents(before, after) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "codex-guard-diff-"));
  const beforePath = join(temporaryDirectory, "before");
  const afterPath = join(temporaryDirectory, "after");
  writeFileSync(beforePath, before ?? "", "utf8");
  writeFileSync(afterPath, after ?? "", "utf8");
  try {
    const result = spawnSync(GIT_EXECUTABLE, ["diff", "--no-index", "--unified=0", "--no-color", beforePath, afterPath], { encoding: "utf8", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== 1) throw new Error((result.stderr || result.stdout || `git diff exit ${result.status}`).trim());
    const diff = result.stdout || "";
    return {
      added: parseAddedLines(diff),
      removed: diff.split(/\r?\n/).filter((line) => line.startsWith("-") && !line.startsWith("---")),
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}


function headDelta(root, file) {
  const text = git(root, ['diff', 'HEAD', '--unified=0', '--no-color', '--', file]);
  return { added: parseAddedLines(text), removed: text.split(/\r?\n/).filter(s => s.startsWith('-') && !s.startsWith('---')) };
}
function records(meta, current, saved) {
  const result = [], root = meta.projectRoot;
  const paths = [...new Set([...current.tracked, ...current.untracked, ...(saved?.tracked ?? []), ...(saved?.untracked ?? [])])].sort();
  for (const file of paths) {
    const after = content(root, file);
    if (saved && Object.hasOwn(saved.contents, file)) {
      if (saved.contents[file] !== after) result.push({ path: file, ...diffFromContents(saved.contents[file], after) });
    } else if (current.untracked.includes(file)) {
      if (after !== null) result.push({ path: file, added: after.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 })), removed: [] });
    } else result.push({ path: file, ...headDelta(root, file) });
  }
  return result;
}
function contractHistory(meta, findings) {
  const file = join(meta.projectRoot, HISTORY_FILE); if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(data?.replacements)) { findings.push(review('contract-history-format', 'historical registry format unsupported; scan continues')); return []; }
    findings.push({ level: 'INFO', rule: 'contract-history', reason: `KNOWN HISTORICAL CONTRACT CHANGE: ${data.replacements.length} historical records; markers are informational`, path: HISTORY_FILE, line: '—' });
    return data.replacements;
  } catch { findings.push(review('contract-history-unreadable', 'historical registry unreadable; scan continues')); return []; }
}
function inspect(changes, history) {
  const findings = [];
  for (const change of changes) {
    for (const added of change.added) for (const rule of RULES) {
      if (rule.pattern.test(added.text)) findings.push(review(rule.id, rule.reason, change.path, added.line));
    }
    if (TEST_FILE.test(change.path) && change.removed.some(text => ASSERTION.test(text))) {
      findings.push(review('test-contract-changed', 'existing test contract changed; verify current user requirement with focused tests and necessary E2E', change.path));
      if (history.some(entry => typeof entry?.testFile === 'string' && entry.testFile.replaceAll('\\', '/') === change.path.replaceAll('\\', '/'))) findings.push({ level: 'INFO', rule: 'known-contract-change', reason: 'KNOWN HISTORICAL CONTRACT CHANGE for this test; historical markers do not determine PASS/FAIL', path: change.path, line: '—' });
    }
  }
  return findings;
}
export function exitCodeForFindings(findings) { return findings.some(f => f.level === 'BLOCK') ? 1 : 0; }
export function printReport(findings, changedFiles = 0) {
  console.log(`[root-cause-guard] changed files scanned: ${changedFiles}`);
  for (const level of ['BLOCK', 'REVIEW', 'INFO']) console.log(`${level}: ${findings.filter(f => f.level === level).length}`);
  for (const level of ['BLOCK', 'REVIEW', 'INFO']) {
    console.log(level);
    for (const f of findings.filter(f => f.level === level)) console.log(`- ${f.path}:${f.line} [${f.rule}] ${f.reason}`);
  }
  const code = exitCodeForFindings(findings);
  console.log(code ? 'GUARD BLOCKED' : findings.some(f => f.level === 'REVIEW') ? 'GUARD PASS WITH REVIEWS' : 'GUARD PASS');
  return code;
}
export function main(args = process.argv.slice(2)) {
  try {
    if (args.length !== 1 || !['baseline', 'check'].includes(args[0])) throw new Error('Usage: node root-cause-guard.mjs baseline|check');
    const meta = metadata(process.cwd()), current = status(meta.projectRoot), stateRoot = resolve(process.env.CODEX_GUARD_STATE_ROOT || DEFAULT_STATE_ROOT);
    if (args[0] === 'baseline') { saveBaseline(meta, current, stateRoot); return 0; }
    const findings = [], saved = loadBaseline(meta, stateRoot, findings);
    const changes = records(meta, current, saved), history = contractHistory(meta, findings);
    findings.push(...inspect(changes, history));
    return printReport(findings, changes.length);
  } catch (error) { console.error(`[root-cause-guard] GUARD TOOL FAILURE: ${error.message}`); return 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main();
