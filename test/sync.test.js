import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-sync-'));
const home = path.join(temp, 'home');
const profile = path.join(home, 'profiles', 'desktop');
const pluginA = path.join(temp, 'plugin-a');
const pluginB = path.join(temp, 'plugin-b');
const bin = path.join(temp, 'bin');
const gistFile = path.join(temp, 'gist.json');
const logFile = path.join(temp, 'calls.log');
fs.mkdirSync(profile, { recursive: true });
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(pluginA, { recursive: true });
fs.mkdirSync(path.join(pluginA, 'node_modules', 'ignored'), { recursive: true });
fs.writeFileSync(path.join(pluginA, 'package.json'), JSON.stringify({
  name: '@local/plugin-a',
  version: '1.0.0',
  description: 'Plugin A',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}, null, 2));
fs.writeFileSync(path.join(pluginA, 'index.js'), 'export const value = 1;\n');
fs.writeFileSync(path.join(pluginA, 'README.md'), '# Plugin A\n');
fs.writeFileSync(path.join(pluginA, '.env'), 'SECRET=1\n');
fs.writeFileSync(path.join(pluginA, 'node_modules', 'ignored', 'index.js'), 'ignored\n');
fs.writeFileSync(path.join(profile, 'package.json'), JSON.stringify({
  name: 'test-profile',
  private: true,
  dependencies: { '@local/plugin-a': `link:${pluginA}` },
  dsh: { profile: { bundles: ['@local/plugin-a'] } },
}, null, 2));

fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ command: 'gh', args }) + '\\n');
const out = (value) => { process.stdout.write(value); process.exit(0); };
if (args[0] === 'api' && args[1] === 'user') out('tester\\n');
if (args[0] === 'gist' && args[1] === 'create') {
  const file = args[args.length - 1];
  fs.copyFileSync(file, process.env.FAKE_GIST);
  out('https://gist.github.com/tester/1234567890abcdef1234567890abcdef\\n');
}
if (args[0] === 'gist' && args[1] === 'edit') {
  const file = args[args.length - 1];
  fs.copyFileSync(file, process.env.FAKE_GIST);
  out('');
}
if (args[0] === 'gist' && args[1] === 'view') {
  out(fs.readFileSync(process.env.FAKE_GIST, 'utf8'));
}
out('');
`);
fs.chmodSync(path.join(bin, 'gh'), 0o755);
fs.writeFileSync(path.join(bin, 'pnpm'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ command: 'pnpm', args: process.argv.slice(2) }) + '\\n');
process.exit(0);
`);
fs.chmodSync(path.join(bin, 'pnpm'), 0o755);

process.env.DSH_HOME = home;
process.env.DSH_PROFILE = 'desktop';
process.env.DSH_PROFILE_DIR = profile;
process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
process.env.FAKE_GIST = gistFile;
process.env.FAKE_LOG = logFile;

const sync = await import('../lib/sync.js');

after(() => fs.rmSync(temp, { recursive: true, force: true }));

function readPayload() {
  return JSON.parse(fs.readFileSync(gistFile, 'utf8'));
}

test('discovers linked local plugins and reports an unsynced state', async () => {
  const status = await sync.getStatus();
  assert.equal(status.profile, 'desktop');
  assert.equal(status.account, 'tester');
  assert.equal(status.plugins.length, 1);
  assert.equal(status.plugins[0].name, '@local/plugin-a');
  assert.equal(status.plugins[0].selected, true);
  assert.equal(status.dirty, true);
  assert.equal(status.gistId, '');
});

test('creates a gist, excludes secrets and node_modules, and pushes changes', async () => {
  const created = await sync.createGist();
  assert.equal(created.gistId, '1234567890abcdef1234567890abcdef');
  assert.equal(created.gistUrl, 'https://gist.github.com/tester/1234567890abcdef1234567890abcdef');
  assert.equal(created.dirty, false);

  const payload = readPayload();
  assert.equal(payload.format, 'dsh-plugin-sync');
  assert.equal(payload.version, 1);
  assert.equal(payload.plugins.length, 1);
  const configured = await sync.updateConfig({ autoPush: true });
  assert.equal(configured.gistId, '1234567890abcdef1234567890abcdef');
  assert.equal(configured.autoPush, true);
  await sync.updateConfig({ autoPush: false });

  const paths = payload.plugins[0].files.map((file) => file.path);
  assert.ok(paths.includes('index.js'));
  assert.ok(paths.includes('package.json'));
  assert.ok(!paths.includes('.env'));
  assert.ok(!paths.some((file) => file.includes('node_modules')));

  fs.writeFileSync(path.join(pluginA, 'index.js'), 'export const value = 2;\n');
  const dirty = await sync.getStatus();
  assert.equal(dirty.dirty, true);

  const pushed = await sync.pushGist();
  assert.equal(pushed.dirty, false);
  const updated = readPayload();
  assert.equal(updated.plugins[0].files.find((file) => file.path === 'index.js').content, 'export const value = 2;\n');
});

test('pulls missing plugins into managed copies without replacing existing links', async () => {
  const manifest = {
    format: 'dsh-plugin-sync',
    version: 1,
    profile: 'desktop',
    plugins: [
      {
        name: '@local/plugin-a',
        version: '2.0.0',
        files: [{ path: 'package.json', encoding: 'utf8', content: '{}\n' }],
      },
      {
        name: '@local/plugin-b',
        version: '1.2.0',
        files: [
          { path: 'package.json', encoding: 'utf8', content: JSON.stringify({ name: '@local/plugin-b', version: '1.2.0', dsh: { bundle: {} } }) },
          { path: 'index.js', encoding: 'utf8', content: 'export const b = true;\n' },
        ],
      },
    ],
  };
  fs.writeFileSync(gistFile, JSON.stringify(manifest));

  const result = await sync.pullGist({ overwrite: false });
  assert.equal(result.installed.length, 1);
  assert.equal(result.installed[0].name, '@local/plugin-b');
  assert.equal(result.skipped.some((entry) => entry.name === '@local/plugin-a' && entry.reason === 'existing'), true);
  assert.equal(result.requiresRestart, true);

  const target = path.join(home, 'plugin-sync', 'plugins', 'local-plugin-b');
  assert.equal(fs.existsSync(path.join(target, 'index.js')), true);
  const profileData = JSON.parse(fs.readFileSync(path.join(profile, 'package.json'), 'utf8'));
  assert.equal(profileData.dependencies['@local/plugin-b'], `link:${target}`);
  assert.ok(profileData.dsh.profile.bundles.includes('@local/plugin-b'));
  assert.ok(fs.readFileSync(logFile, 'utf8').includes('"command":"pnpm"'));
});

test('auto-push uploads a changed plugin without a manual click', async () => {
  await sync.updateConfig({ autoPush: true });
  const payloadBefore = readPayload();
  assert.ok(payloadBefore.plugins.some((plugin) => plugin.name === '@local/plugin-a'));
  fs.writeFileSync(path.join(pluginA, 'index.js'), 'export const value = 3;\n');
  sync.startAutoPush(30);
  await new Promise((resolve) => setTimeout(resolve, 300));
  sync.stopAutoPush();
  const payloadAfter = readPayload();
  const file = payloadAfter.plugins
    .find((plugin) => plugin.name === '@local/plugin-a')
    .files.find((entry) => entry.path === 'index.js');
  assert.equal(file.content, 'export const value = 3;\n');
  await sync.updateConfig({ autoPush: false });
});

test('rejects a manifest that tries to escape the plugin directory', async () => {
  const manifest = {
    format: 'dsh-plugin-sync',
    version: 1,
    plugins: [{
      name: '@local/plugin-c',
      version: '1.0.0',
      files: [{ path: '../escape.js', encoding: 'utf8', content: 'bad' }],
    }],
  };
  fs.writeFileSync(gistFile, JSON.stringify(manifest));
  await assert.rejects(
    sync.pullGist({ overwrite: true }),
    (error) => error.code === 'INVALID_MANIFEST',
  );
  assert.equal(fs.existsSync(path.join(home, 'plugin-sync', 'escape.js')), false);
});
