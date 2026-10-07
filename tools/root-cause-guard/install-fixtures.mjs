import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const tools = dirname(fileURLToPath(import.meta.url));
test('isolated installer copies exactly, preserves old runtime and leaves unrelated files untouched', () => {
  const top = mkdtempSync(join(tmpdir(), 'guard-install-fixture-'));
  const scripts = join(top, '.codex', 'scripts');
  mkdirSync(scripts, { recursive: true });
  const target = join(scripts, 'root-cause-guard.mjs');
  const protectedFiles = ['.codex/AGENTS.md', '.codex/AGENTS.override.md', 'state/baseline.json', 'root-cause-guard.contract-replacements.json', 'src/product.js'];
  for (const file of protectedFiles) {
    mkdirSync(dirname(join(top, file)), { recursive: true });
    writeFileSync(join(top, file), 'fixture sentinel: unchanged\n');
  }
  const before = protectedFiles.map(file => readFileSync(join(top, file)));
  function run() {
    const childEnv = { ...process.env };
    // Windows PowerShell must resolve its own modules, not an inherited PS7 module path.
    for (const key of Object.keys(childEnv)) if (key.toLowerCase() === 'psmodulepath') delete childEnv[key];
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(tools, 'install-local.ps1'), '-Destination', target], { encoding: 'utf8', windowsHide: true, env: childEnv });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
  }
  assert.match(run(), /INSTALL VERIFIED/);
  assert.deepEqual(readFileSync(target), readFileSync(join(tools, 'root-cause-guard.mjs')));
  writeFileSync(target, 'old runtime fixture\n');
  assert.match(run(), /Previous runtime preserved/);
  const backups = readdirSync(scripts).filter(file => file.endsWith('.bak'));
  assert.equal(backups.length, 1);
  assert.equal(readFileSync(join(scripts, backups[0]), 'utf8'), 'old runtime fixture\n');
  assert.deepEqual(readFileSync(target), readFileSync(join(tools, 'root-cause-guard.mjs')));
  assert.match(run(), /ALREADY SYNCED/);
  assert.equal(readdirSync(scripts).filter(file => file.endsWith('.bak')).length, 1);
  protectedFiles.forEach((file, index) => assert.deepEqual(readFileSync(join(top, file)), before[index]));
});
