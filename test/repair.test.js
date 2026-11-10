import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// These tests reproduce the environment of a GUI-launched Harness process:
// PATH only contains the system directories, so plain `pnpm` and `gh`
// lookups would fail without the plugin's own search-path extension.

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-sync-path-'));
const home = path.join(temp, 'home');
const profile = path.join(home, 'profiles', 'desktop');
const bin = path.join(temp, 'bin');
const gistFile = path.join(temp, 'gist.json');
const logFile = path.join(temp, 'calls.log');
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(bin, { recursive: true });

fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ command: 'gh', args }) + '\\n');
const out = (value) => { process.stdout.write(value); process.exit(0); };
if (args[0] === 'api' && args[1] === 'user') out('tester');
if (args[0] === 'auth' && args[1] === 'status') {
  out(JSON.stringify({ hosts: { 'github.com': [
    { state: 'success', active: true, host: 'github.com', login: 'tester' },
  ] } }));
}
if (args[0] === 'auth' && args[1] === 'token') {
  out('token-tester');
}
if (args[0] === 'gist' && !process.env.GH_TOKEN) {
  process.stderr.write('missing GH_TOKEN');
  process.exit(1);
}
if (args[0] === 'gist' && args[1] === 'view') {
  out(fs.readFileSync(process.env.FAKE_GIST, 'utf8'));
}
out('');
`);
fs.chmodSync(path.join(bin, 'gh'), 0o755);

// A fake pnpm that behaves like the real one for this test: it links every
// profile dependency into node_modules so the post-install verification can
// distinguish a completed install from a half-installed one.
fs.writeFileSync(path.join(bin, 'pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ command: 'pnpm', args: process.argv.slice(2) }) + '\\n');
const profile = process.env.DSH_PROFILE_DIR;
const pkg = JSON.parse(fs.readFileSync(path.join(profile, 'package.json'), 'utf8'));
for (const name of Object.keys(pkg.dependencies || {})) {
  const dir = path.join(profile, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
}
process.exit(0);
`);
fs.chmodSync(path.join(bin, 'pnpm'), 0o755);

process.env.DSH_HOME = home;
process.env.DSH_PROFILE = 'desktop';
process.env.DSH_PROFILE_DIR = profile;
// GUI-like minimal PATH plus PNPM_HOME pointing at the fake tool directory.
process.env.PATH = [
  path.dirname(process.execPath),
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
].join(path.delimiter);
process.env.PNPM_HOME = bin;
process.env.FAKE_GIST = gistFile;
process.env.FAKE_LOG = logFile;

fs.writeFileSync(path.join(profile, 'package.json'), JSON.stringify({
  name: 'test-profile',
  private: true,
  dependencies: {},
  dsh: { profile: { bundles: [] } },
}, null, 2));

// A connected gist so pullGist can run without createGist first.
fs.mkdirSync(path.join(home, 'plugin-sync'), { recursive: true });
fs.writeFileSync(path.join(home, 'plugin-sync', 'config.json'), JSON.stringify({
  version: 1,
  account: 'tester',
  gistId: '1234567890abcdef1234567890abcdef',
  gistUrl: 'https://gist.github.com/tester/1234567890abcdef1234567890abcdef',
  autoPush: false,
  selectedPlugins: null,
  lastPushedDigest: '',
  lastPushedAt: null,
  lastError: '',
}, null, 2));

const sync = await import('../lib/sync.js');

after(() => fs.rmSync(temp, { recursive: true, force: true }));

function manifestFor(entries) {
  return {
    format: 'dsh-plugin-sync',
    version: 1,
    profile: 'desktop',
    plugins: entries.map(({ name, version }) => ({
      name,
      version,
      files: [
        { path: 'package.json', encoding: 'utf8', content: JSON.stringify({ name, version, dsh: { bundle: {} } }) },
        { path: 'index.js', encoding: 'utf8', content: 'export const value = 1;\n' },
      ],
    })),
  };
}

test('pull works when gh and pnpm are outside the GUI process PATH', async () => {
  fs.writeFileSync(gistFile, JSON.stringify(manifestFor([
    { name: '@local/plugin-path', version: '1.0.0' },
  ])));
  const result = await sync.pullGist({ overwrite: false });
  assert.equal(result.installed.length, 1);
  assert.equal(result.pnpmWarning, '');
  assert.ok(fs.existsSync(path.join(profile, 'node_modules', '@local', 'plugin-path')));
  assert.ok(fs.readFileSync(logFile, 'utf8').includes('"command":"pnpm"'));
});

test('a repeated pull repairs a half-installed managed link', async () => {
  const managed = path.join(home, 'plugin-sync', 'plugins', 'local-plugin-broken');
  fs.mkdirSync(managed, { recursive: true });
  fs.writeFileSync(path.join(managed, 'package.json'), JSON.stringify({
    name: '@local/plugin-broken',
    version: '1.0.0',
    dsh: { bundle: {} },
  }, null, 2));
  fs.writeFileSync(path.join(managed, 'index.js'), 'export const broken = true;\n');
  // The state a previous pull leaves behind when pnpm never ran: the managed
  // copy exists, the profile references it, but node_modules has no entry.
  fs.writeFileSync(path.join(profile, 'package.json'), JSON.stringify({
    name: 'test-profile',
    private: true,
    dependencies: {
      '@local/plugin-broken': `link:${managed}`,
      '@local/plugin-dev': 'link:/tmp/definitely-not-managed/plugin-dev',
    },
    dsh: { profile: { bundles: ['@local/plugin-broken', '@local/plugin-dev'] } },
  }, null, 2));

  fs.writeFileSync(gistFile, JSON.stringify(manifestFor([
    { name: '@local/plugin-broken', version: '1.0.0' },
    { name: '@local/plugin-dev', version: '1.0.0' },
  ])));

  const result = await sync.pullGist({ overwrite: false });
  assert.equal(result.installed.length, 1);
  assert.equal(result.installed[0].name, '@local/plugin-broken');
  assert.equal(result.installed[0].repaired, true);
  assert.equal(result.skipped.some((entry) => entry.name === '@local/plugin-dev' && entry.reason === 'existing'), true);
  assert.equal(result.pnpmWarning, '');
  assert.ok(fs.existsSync(path.join(profile, 'node_modules', '@local', 'plugin-broken')));

  // Dev links must survive untouched.
  const profileData = JSON.parse(fs.readFileSync(path.join(profile, 'package.json'), 'utf8'));
  assert.equal(profileData.dependencies['@local/plugin-dev'], 'link:/tmp/definitely-not-managed/plugin-dev');
  assert.equal(fs.existsSync(path.join(home, 'plugin-sync', 'plugins', 'local-plugin-dev')), false);
});
