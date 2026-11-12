import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// The preflight check must work with the same GUI-like minimal PATH as the
// pull flow: tools are found through PNPM_HOME and the search path, not
// through the process PATH alone.

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-sync-preflight-'));
const home = path.join(temp, 'home');
const profile = path.join(home, 'profiles', 'desktop');
const ghDir = path.join(temp, 'gh-bin');
const pnpmDir = path.join(temp, 'pnpm-bin');
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(ghDir, { recursive: true });
fs.mkdirSync(pnpmDir, { recursive: true });

fs.writeFileSync(path.join(ghDir, 'gh'), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') {
  process.stdout.write(JSON.stringify({ hosts: { 'github.com': [
    { state: 'success', active: true, host: 'github.com', login: 'tester' },
  ] } }));
  process.exit(0);
}
process.exit(1);
`);
fs.chmodSync(path.join(ghDir, 'gh'), 0o755);

// The pnpm existence check only resolves the executable; a placeholder is
// enough because preflight never spawns pnpm itself.
fs.writeFileSync(path.join(pnpmDir, 'pnpm'), '#!/bin/sh\nexit 0\n');
fs.chmodSync(path.join(pnpmDir, 'pnpm'), 0o755);

process.env.DSH_HOME = home;
process.env.DSH_PROFILE = 'desktop';
process.env.DSH_PROFILE_DIR = profile;
// Redirect HOME so the search path probes the fake home instead of the real
// one (which has its own ~/.local/bin tools on this machine).
process.env.HOME = home;
// GUI-like PATH: the gh directory is visible as if gh were installed
// system-wide, but pnpm only exists under PNPM_HOME.
process.env.PATH = [
  path.dirname(process.execPath),
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  ghDir,
].join(path.delimiter);
process.env.PNPM_HOME = pnpmDir;

const sync = await import('../lib/sync.js');

after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('preflight reports a ready device with gh authenticated and pnpm present', async () => {
  const check = await sync.preflight();
  assert.equal(check.ready, true);
  assert.equal(check.gh.found, true);
  assert.equal(check.gh.authed, true);
  assert.equal(check.gh.account, 'tester');
  assert.equal(check.pnpm.found, true);
  assert.equal(check.node, process.version);
  assert.equal(typeof check.hints.gh, 'string');
  assert.equal(typeof check.hints.pnpm, 'string');
});

test('preflight flags a missing pnpm with an install hint and stays honest about gh', async () => {
  delete process.env.PNPM_HOME;
  try {
    const check = await sync.preflight();
    assert.equal(check.pnpm.found, false);
    assert.equal(check.gh.found, true);
    assert.equal(check.gh.authed, true);
    assert.equal(check.ready, false);
    assert.equal(typeof check.hints.pnpm, 'string');
    assert.ok(check.hints.pnpm.length > 0);
  } finally {
    process.env.PNPM_HOME = pnpmDir;
  }
});

test('preflight without gh authentication is not ready', async () => {
  // A gh that is installed but has no authenticated host (empty hosts list).
  const unauthDir = path.join(temp, 'gh-unauth');
  fs.mkdirSync(unauthDir, { recursive: true });
  fs.writeFileSync(path.join(unauthDir, 'gh'), `#!/usr/bin/env node
if (process.argv[2] === 'auth' && process.argv[3] === 'status') {
  process.stdout.write(JSON.stringify({ hosts: {} }));
  process.exit(0);
}
process.exit(1);
`);
  fs.chmodSync(path.join(unauthDir, 'gh'), 0o755);
  const previousPath = process.env.PATH;
  // Put the unauthenticated fake before every other gh in the search order.
  process.env.PATH = [
    unauthDir,
    path.dirname(process.execPath),
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ].join(path.delimiter);
  try {
    const check = await sync.preflight();
    assert.equal(check.gh.found, true);
    assert.equal(check.gh.authed, false);
    assert.equal(check.ready, false);
  } finally {
    process.env.PATH = previousPath;
  }
});
