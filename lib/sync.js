/**
 * Local plugin source sync through a GitHub gist.
 *
 * A gist is a single flat file here: one manifest containing every selected
 * local plugin source file. Plugin code is never executed during sync, and the
 * GitHub CLI is always invoked through execFile with an explicit argument list.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export class SyncError extends Error {
  constructor(message, { code = 'SYNC_FAILED', status = 500, detail } = {}) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
    if (detail !== undefined) this.detail = detail;
  }
}

const SELF_NAME = '@local/dsh-plugin-sync';
const GIST_FILE = 'dsh-plugin-sync.json';
const FORMAT = 'dsh-plugin-sync';
const FORMAT_VERSION = 1;
const MAX_PLUGINS = 50;
const MAX_FILES = 400;
const MAX_FILE_BYTES = 2_000_000;
const MAX_PLUGIN_BYTES = 6_000_000;
const MAX_TOTAL_BYTES = 8_000_000;
const MAX_SELECTED = 50;
const COMMAND_TIMEOUT = 60_000;

let activeOperation = null;
let autoPushTimer = null;
let autoTickRunning = false;
let accountCache = { at: 0, value: null };

function profilePath() {
  return process.env.DSH_PROFILE_DIR
    || path.join(dshHome(), 'profiles', process.env.DSH_PROFILE || 'desktop');
}

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}

function profileName() {
  return process.env.DSH_PROFILE || path.basename(profilePath());
}

function syncRoot() {
  return path.join(dshHome(), 'plugin-sync');
}

function configPath() {
  return path.join(syncRoot(), 'config.json');
}

function managedPluginsRoot() {
  return path.join(syncRoot(), 'plugins');
}

function profilePackagePath() {
  return path.join(profilePath(), 'package.json');
}

async function run(command, args, { cwd, timeout = COMMAND_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        CLICOLOR: '0',
        GH_PROMPT_DISABLED: '1',
        GH_NO_UPDATE_NOTIFIER: '1',
        GIT_TERMINAL_PROMPT: '0',
      },
      timeout,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolve({
        code: error === null ? 0 : (typeof error.code === 'number' ? error.code : 1),
        timedOut: Boolean(error?.killed),
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        missing: error?.code === 'ENOENT',
      });
    });
  });
}

function cleanMessage(value, fallback = 'The plugin sync failed.') {
  const text = String(value ?? '').replace(/\u0000/g, '').trim();
  return text.length > 1_500 ? `${text.slice(0, 1_500)}…` : (text || fallback);
}

function commandFailure(result, label = 'GitHub CLI') {
  if (result.missing) {
    return new SyncError(`${label} is not installed.`, {
      code: 'SYNC_CLI_MISSING',
      status: 503,
    });
  }
  if (result.timedOut) {
    return new SyncError('The sync command took too long.', {
      code: 'SYNC_TIMEOUT',
      status: 504,
    });
  }
  const text = cleanMessage(result.stderr || result.stdout, 'The sync command failed.');
  if (/auth|unauthorized|bad credentials|token/i.test(text)) {
    return new SyncError('GitHub authentication is required. Run gh auth login and retry.', {
      code: 'SYNC_AUTH',
      status: 401,
    });
  }
  if (/not found|404|does not exist/i.test(text)) {
    return new SyncError('The gist or gist file was not found.', {
      code: 'SYNC_GIST_NOT_FOUND',
      status: 404,
      detail: text,
    });
  }
  return new SyncError(text, { code: 'SYNC_COMMAND_FAILED', status: 422 });
}

async function gh(args, options = {}) {
  const result = await run('gh', args, options);
  if (result.code !== 0) throw commandFailure(result);
  return result.stdout;
}

function defaultConfig() {
  return {
    version: 1,
    gistId: '',
    gistUrl: '',
    autoPush: false,
    selectedPlugins: null,
    lastPushedDigest: '',
    lastPushedAt: null,
    lastError: '',
  };
}

function normalizeConfig(value) {
  const base = defaultConfig();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  return {
    ...base,
    gistId: typeof value.gistId === 'string' ? value.gistId : '',
    gistUrl: typeof value.gistUrl === 'string' ? value.gistUrl : '',
    autoPush: value.autoPush === true,
    selectedPlugins: Array.isArray(value.selectedPlugins)
      ? value.selectedPlugins.filter((name) => typeof name === 'string')
      : null,
    lastPushedDigest: typeof value.lastPushedDigest === 'string' ? value.lastPushedDigest : '',
    lastPushedAt: typeof value.lastPushedAt === 'string' ? value.lastPushedAt : null,
    lastError: typeof value.lastError === 'string' ? value.lastError : '',
  };
}

export async function readConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    if (error?.code === 'ENOENT') return defaultConfig();
    return defaultConfig();
  }
}

async function writeConfig(value) {
  const config = normalizeConfig(value);
  await fs.mkdir(syncRoot(), { recursive: true, mode: 0o700 });
  const temporary = `${configPath()}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(config, null, 2), 'utf8');
  await fs.chmod(temporary, 0o600);
  await fs.rename(temporary, configPath());
  return config;
}

function parseGist(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { gistId: '', gistUrl: '' };
  let id = raw;
  let url = '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const parsed = new URL(raw);
      if (!/(^|\.)gist\.github\.com$/i.test(parsed.hostname)) {
        throw new SyncError('Use a gist.github.com URL.', { code: 'INVALID_GIST', status: 400 });
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      id = parts[parts.length - 1] || '';
      url = parsed.href;
    }
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError('The gist URL is invalid.', { code: 'INVALID_GIST', status: 400 });
  }
  id = id.replace(/[?#].*$/, '');
  if (!/^[a-f0-9]{8,64}$/i.test(id)) {
    throw new SyncError('Enter a gist URL or a valid gist id.', { code: 'INVALID_GIST', status: 400 });
  }
  return {
    gistId: id,
    gistUrl: url || `https://gist.github.com/${id}`,
  };
}

async function readProfilePackage() {
  let raw;
  try {
    raw = await fs.readFile(profilePackagePath(), 'utf8');
  } catch {
    throw new SyncError('The profile package.json could not be read.', {
      code: 'PROFILE_READ_FAILED',
      status: 500,
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SyncError('The profile package.json is invalid.', {
      code: 'PROFILE_INVALID',
      status: 422,
    });
  }
  if (!parsed.dsh || typeof parsed.dsh !== 'object') parsed.dsh = {};
  if (!parsed.dsh.profile || typeof parsed.dsh.profile !== 'object') parsed.dsh.profile = {};
  if (!Array.isArray(parsed.dsh.profile.bundles)) parsed.dsh.profile.bundles = [];
  if (!parsed.dependencies || typeof parsed.dependencies !== 'object') parsed.dependencies = {};
  return parsed;
}

async function writeProfilePackage(value) {
  const file = profilePackagePath();
  const backup = `${file}.dsh-plugin-sync.bak`;
  try {
    await fs.copyFile(file, backup);
  } catch {
    // A backup is best-effort.
  }
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, file);
}

function specDirectory(spec) {
  if (typeof spec !== 'string') return '';
  const match = spec.match(/^(?:link|file):(.+)$/);
  if (!match) return '';
  return match[1];
}

async function listLocalPlugins() {
  const profile = await readProfilePackage();
  const plugins = [];
  const seen = new Set();
  for (const [dependencyName, spec] of Object.entries(profile.dependencies)) {
    const directory = specDirectory(spec);
    if (!directory) continue;
    const resolved = path.resolve(profilePath(), directory);
    let real = resolved;
    try {
      real = await fs.realpath(resolved);
      const stat = await fs.stat(real);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    if (real.split(path.sep).includes('node_modules')) continue;
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(path.join(real, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    const name = typeof pkg.name === 'string' && pkg.name ? pkg.name : dependencyName;
    if (!name.startsWith('@local/') || name === SELF_NAME) continue;
    if (!pkg.dsh || typeof pkg.dsh !== 'object') continue;
    if (seen.has(name)) continue;
    seen.add(name);
    plugins.push({
      name,
      version: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
      description: typeof pkg.description === 'string' ? pkg.description : '',
      directory: real,
      dependency: dependencyName,
    });
  }
  return plugins.sort((left, right) => left.name.localeCompare(right.name));
}

function selectedSetFor(config, plugins) {
  const available = new Set(plugins.map((plugin) => plugin.name));
  if (config.selectedPlugins === null) return available;
  return new Set(config.selectedPlugins.filter((name) => available.has(name)));
}

const IGNORED_NAMES = new Set([
  '.DS_Store', '.git', '.inspect', 'node_modules', '.turbo', '.cache',
  'coverage', '.env', '.npmrc', '.netrc',
]);
const IGNORED_SUFFIXES = ['.pem', '.key', '.log'];
const IGNORED_PREFIXES = ['.env.'];

function ignoredRelative(relative) {
  const parts = relative.split('/');
  if (parts.some((part) => IGNORED_NAMES.has(part))) return true;
  const name = parts[parts.length - 1];
  if (IGNORED_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
  return IGNORED_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

async function walkFiles(root, directory = root, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (ignoredRelative(relative)) continue;
    if (entry.isDirectory()) {
      await walkFiles(root, absolute, output);
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_BYTES) {
        throw new SyncError(`File too large for sync: ${relative}`, {
          code: 'PLUGIN_FILE_TOO_LARGE',
          status: 413,
        });
      }
      output.push({ absolute, relative, bytes: stat.size });
      if (output.length > MAX_FILES) {
        throw new SyncError('A plugin has too many files to sync.', {
          code: 'PLUGIN_TOO_MANY_FILES',
          status: 413,
        });
      }
    }
  }
  return output;
}

async function collectPluginFiles(plugin) {
  const files = await walkFiles(plugin.directory);
  const result = [];
  let total = 0;
  for (const file of files) {
    const buffer = await fs.readFile(file.absolute);
    total += buffer.length;
    if (total > MAX_PLUGIN_BYTES) {
      throw new SyncError(`Plugin ${plugin.name} is too large to sync.`, {
        code: 'PLUGIN_TOO_LARGE',
        status: 413,
      });
    }
    const binary = buffer.subarray(0, 8_000).includes(0);
    result.push({
      path: file.relative,
      encoding: binary ? 'base64' : 'utf8',
      content: binary ? buffer.toString('base64') : buffer.toString('utf8'),
    });
  }
  return { files: result, bytes: total };
}

function pluginSlug(name) {
  return name
    .replace(/^@/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'plugin';
}

function digestPlugins(plugins) {
  return createHash('sha256').update(JSON.stringify(plugins)).digest('hex');
}

async function buildManifestFor(allPlugins, selected) {
  const chosen = allPlugins.filter((plugin) => selected.has(plugin.name));
  if (chosen.length === 0) {
    throw new SyncError('Select at least one local plugin.', {
      code: 'NO_PLUGINS',
      status: 400,
    });
  }
  const manifestPlugins = [];
  let bytes = 0;
  for (const plugin of chosen) {
    const collected = await collectPluginFiles(plugin);
    bytes += collected.bytes;
    if (bytes > MAX_TOTAL_BYTES) {
      throw new SyncError('The selected plugins are too large for one gist.', {
        code: 'SYNC_TOO_LARGE',
        status: 413,
      });
    }
    manifestPlugins.push({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      directory: pluginSlug(plugin.name),
      files: collected.files,
    });
  }
  const digest = digestPlugins(manifestPlugins);
  return {
    manifest: {
      format: FORMAT,
      version: FORMAT_VERSION,
      generator: '@local/dsh-plugin-sync',
      profile: profileName(),
      updatedAt: new Date().toISOString(),
      plugins: manifestPlugins,
    },
    digest,
    bytes,
  };
}

async function selectedManifest(config, allPlugins = null) {
  const plugins = allPlugins ?? await listLocalPlugins();
  const selected = selectedSetFor(config, plugins);
  const built = await buildManifestFor(plugins, selected);
  return { ...built, plugins };
}

async function readAccount(force = false) {
  const now = Date.now();
  if (!force && accountCache.value && now - accountCache.at < 60_000) return accountCache.value;
  try {
    const result = await run('gh', ['api', 'user', '--jq', '.login'], { timeout: 10_000 });
    const login = result.code === 0 ? result.stdout.trim() : '';
    accountCache = { at: now, value: login || null };
  } catch {
    accountCache = { at: now, value: null };
  }
  return accountCache.value;
}

export async function getStatus() {
  const config = await readConfig();
  const plugins = await listLocalPlugins();
  const selected = selectedSetFor(config, plugins);
  let built = null;
  let error = '';
  try {
    built = await buildManifestFor(plugins, selected);
  } catch (failure) {
    error = cleanMessage(failure?.message, 'The selected plugins could not be read.');
  }
  const selectedNames = new Set(selected);
  const entries = plugins.map((plugin) => {
    const manifestPlugin = built?.manifest.plugins.find((entry) => entry.name === plugin.name);
    return {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      directory: plugin.directory,
      selected: selectedNames.has(plugin.name),
      files: manifestPlugin?.files.length ?? 0,
      bytes: manifestPlugin
        ? manifestPlugin.files.reduce((sum, file) => sum + Buffer.byteLength(file.content, file.encoding === 'base64' ? 'base64' : 'utf8'), 0)
        : 0,
    };
  });
  const dirty = Boolean(config.gistId)
    ? Boolean(built) && built.digest !== config.lastPushedDigest
    : plugins.length > 0;
  return {
    profile: profileName(),
    profileDirectory: profilePath(),
    gistId: config.gistId,
    gistUrl: config.gistUrl || (config.gistId ? `https://gist.github.com/${config.gistId}` : ''),
    autoPush: config.autoPush,
    selectedPlugins: [...selected],
    plugins: entries,
    dirty,
    lastPushedAt: config.lastPushedAt,
    lastError: config.lastError || error,
    busy: activeOperation,
    account: await readAccount(),
    totalBytes: built?.bytes ?? 0,
    digest: built?.digest ?? '',
    maxGistBytes: MAX_TOTAL_BYTES,
  };
}

async function withBusy(operation, callback) {
  if (activeOperation) {
    throw new SyncError('Another plugin sync operation is already running.', {
      code: 'SYNC_BUSY',
      status: 409,
    });
  }
  activeOperation = operation;
  try {
    return await callback();
  } finally {
    activeOperation = null;
  }
}

export async function updateConfig(input = {}) {
  const current = await readConfig();
  const next = { ...current };
  if (input.gist !== undefined) {
    const parsed = parseGist(input.gist);
    if (parsed.gistId !== current.gistId) {
      next.gistId = parsed.gistId;
      next.gistUrl = parsed.gistUrl;
      next.lastPushedDigest = '';
      next.lastPushedAt = null;
      next.lastError = '';
    }
  }
  if (input.autoPush !== undefined) {
    next.autoPush = input.autoPush === true;
  }
  if (input.selectedPlugins !== undefined) {
    if (!Array.isArray(input.selectedPlugins)) {
      throw new SyncError('Selected plugins must be a list.', { code: 'INVALID_SELECTION', status: 400 });
    }
    const available = new Set((await listLocalPlugins()).map((plugin) => plugin.name));
    next.selectedPlugins = [...new Set(input.selectedPlugins)]
      .filter((name) => typeof name === 'string' && available.has(name))
      .slice(0, MAX_SELECTED);
  }
  await writeConfig(next);
  return getStatus();
}

async function writeGistPayload(manifest, { create }) {
  const config = await readConfig();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-plugin-sync-'));
  const file = path.join(directory, GIST_FILE);
  try {
    await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    let gistId = config.gistId;
    let gistUrl = config.gistUrl;
    if (create) {
      const output = await gh([
        'gist',
        'create',
        '--desc',
        `DSH plugin sync (${profileName()})`,
        file,
      ], { timeout: 120_000 });
      const match = output.match(/https:\/\/gist\.github\.com\/[^\s]+/);
      if (!match) {
        throw new SyncError('GitHub did not return a gist URL.', {
          code: 'SYNC_GIST_RESPONSE',
          status: 502,
        });
      }
      const parsed = parseGist(match[0]);
      gistId = parsed.gistId;
      gistUrl = parsed.gistUrl;
    } else {
      if (!gistId) {
        throw new SyncError('Create or connect a gist first.', {
          code: 'SYNC_NO_GIST',
          status: 400,
        });
      }
      try {
        await gh(['gist', 'edit', gistId, '--filename', GIST_FILE, file], { timeout: 120_000 });
      } catch (failure) {
        if (!(failure instanceof SyncError) || failure.status !== 404) throw failure;
        await gh(['gist', 'edit', gistId, '--add', file], { timeout: 120_000 });
      }
    }
    return { gistId, gistUrl };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function performPush({ create = false } = {}) {
  const config = await readConfig();
  if (!create && !config.gistId) {
    throw new SyncError('Create or connect a gist first.', {
      code: 'SYNC_NO_GIST',
      status: 400,
    });
  }
  const built = await selectedManifest(config);
  const gist = await writeGistPayload(built.manifest, { create });
  const next = {
    ...config,
    ...gist,
    lastPushedDigest: built.digest,
    lastPushedAt: new Date().toISOString(),
    lastError: '',
  };
  await writeConfig(next);
  return {
    ...(await getStatus()),
    pushed: true,
    gistId: gist.gistId,
    gistUrl: gist.gistUrl,
  };
}

export async function createGist() {
  return withBusy('create', () => performPush({ create: true }));
}

export async function pushGist() {
  return withBusy('push', () => performPush({ create: false }));
}

function validateRelative(relative) {
  if (typeof relative !== 'string' || !relative || relative.length > 500) {
    throw new SyncError('A gist file path is invalid.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  if (relative.includes('\\') || relative.includes('\0')) {
    throw new SyncError('A gist file path is invalid.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  if (relative.startsWith('/') || /^[A-Za-z]:/.test(relative)) {
    throw new SyncError('A gist file path is absolute.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  const parts = relative.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new SyncError('A gist file path escapes the plugin directory.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  if (parts.includes('.git') || parts.includes('node_modules')) {
    throw new SyncError('A gist file path is not allowed.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  return parts.join('/');
}

function validateManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SyncError('The gist does not contain a plugin sync document.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  if (raw.format !== FORMAT || raw.version !== FORMAT_VERSION) {
    throw new SyncError('The gist uses an unsupported plugin sync format.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  if (!Array.isArray(raw.plugins) || raw.plugins.length === 0 || raw.plugins.length > MAX_PLUGINS) {
    throw new SyncError('The gist contains no valid plugin list.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  const names = new Set();
  const plugins = raw.plugins.map((plugin) => {
    if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)) {
      throw new SyncError('The gist contains an invalid plugin.', { code: 'INVALID_MANIFEST', status: 422 });
    }
    const name = typeof plugin.name === 'string' ? plugin.name.trim() : '';
    if (!/^@local\/[a-z0-9][a-z0-9._-]{0,80}$/i.test(name)) {
      throw new SyncError(`The gist contains an unsupported plugin name: ${name || '(empty)'}`, {
        code: 'INVALID_MANIFEST',
        status: 422,
      });
    }
    if (names.has(name)) {
      throw new SyncError('The gist contains a duplicate plugin.', { code: 'INVALID_MANIFEST', status: 422 });
    }
    names.add(name);
    if (!Array.isArray(plugin.files) || plugin.files.length === 0 || plugin.files.length > MAX_FILES) {
      throw new SyncError(`The gist plugin ${name} has no valid files.`, { code: 'INVALID_MANIFEST', status: 422 });
    }
    let total = 0;
    const files = plugin.files.map((file) => {
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        throw new SyncError('The gist contains an invalid file.', { code: 'INVALID_MANIFEST', status: 422 });
      }
      const relative = validateRelative(file.path);
      const encoding = file.encoding === 'base64' ? 'base64' : 'utf8';
      if (typeof file.content !== 'string') {
        throw new SyncError('The gist contains a non-text file payload.', { code: 'INVALID_MANIFEST', status: 422 });
      }
      const bytes = Buffer.byteLength(file.content, encoding);
      if (bytes > MAX_FILE_BYTES) {
        throw new SyncError(`The gist file ${relative} is too large.`, { code: 'INVALID_MANIFEST', status: 413 });
      }
      total += bytes;
      if (total > MAX_PLUGIN_BYTES) {
        throw new SyncError(`The gist plugin ${name} is too large.`, { code: 'INVALID_MANIFEST', status: 413 });
      }
      return {
        path: relative,
        encoding,
        content: file.content,
        bytes,
      };
    });
    return {
      name,
      version: typeof plugin.version === 'string' ? plugin.version : '0.0.0',
      description: typeof plugin.description === 'string' ? plugin.description : '',
      files,
    };
  });
  return {
    ...raw,
    plugins,
  };
}

async function installPlugin(plugin) {
  const root = managedPluginsRoot();
  const target = path.join(root, pluginSlug(plugin.name));
  const resolved = path.resolve(target);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new SyncError('The plugin target escaped the sync directory.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.rm(temporary, { recursive: true, force: true });
  await fs.mkdir(temporary, { recursive: true });
  for (const file of plugin.files) {
    const destination = path.resolve(temporary, file.path);
    if (!destination.startsWith(`${path.resolve(temporary)}${path.sep}`)) {
      throw new SyncError('A gist file path escaped the plugin directory.', { code: 'INVALID_MANIFEST', status: 422 });
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const buffer = file.encoding === 'base64'
      ? Buffer.from(file.content, 'base64')
      : Buffer.from(file.content, 'utf8');
    await fs.writeFile(destination, buffer);
  }
  await fs.rm(target, { recursive: true, force: true });
  await fs.rename(temporary, target);
  return target;
}

async function readGistManifest(gistId) {
  const raw = await gh([
    'gist',
    'view',
    gistId,
    '--filename',
    GIST_FILE,
    '--raw',
  ], { timeout: 120_000 });
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SyncError('The gist file is not valid JSON.', { code: 'INVALID_MANIFEST', status: 422 });
  }
  return validateManifest(parsed);
}

async function installPnpm(profile) {
  const result = await run('pnpm', ['install', '--ignore-scripts', '--prefer-offline'], {
    cwd: profile,
    timeout: 180_000,
  });
  if (result.code === 0) return '';
  return cleanMessage(result.stderr || result.stdout, 'pnpm install failed.');
}

export async function pullGist({ overwrite = false } = {}) {
  return withBusy('pull', async () => {
    const config = await readConfig();
    if (!config.gistId) {
      throw new SyncError('Create or connect a gist first.', { code: 'SYNC_NO_GIST', status: 400 });
    }
    const manifest = await readGistManifest(config.gistId);
    const profile = await readProfilePackage();
    const installed = [];
    const skipped = [];
    for (const plugin of manifest.plugins) {
      if (plugin.name === SELF_NAME) {
        skipped.push({ name: plugin.name, reason: 'self' });
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(profile.dependencies, plugin.name) && !overwrite) {
        skipped.push({ name: plugin.name, reason: 'existing' });
        continue;
      }
      const target = await installPlugin(plugin);
      profile.dependencies[plugin.name] = `link:${target}`;
      if (!profile.dsh.profile.bundles.includes(plugin.name)) {
        profile.dsh.profile.bundles.push(plugin.name);
      }
      installed.push({ name: plugin.name, path: target, version: plugin.version });
    }
    let pnpmWarning = '';
    if (installed.length > 0) {
      await writeProfilePackage(profile);
      pnpmWarning = await installPnpm(profilePath());
    }
    const nextSelection = config.selectedPlugins === null
      ? null
      : [...new Set([...config.selectedPlugins, ...installed.map((entry) => entry.name)])];
    await writeConfig({
      ...config,
      selectedPlugins: nextSelection,
      gistId: config.gistId,
      gistUrl: config.gistUrl,
      lastError: '',
    });
    return {
      ...(await getStatus()),
      installed,
      skipped,
      requiresRestart: installed.length > 0,
      pnpmWarning,
    };
  });
}

async function autoPushTick() {
  if (autoTickRunning || activeOperation) return;
  const config = await readConfig();
  if (!config.autoPush || !config.gistId) return;
  autoTickRunning = true;
  try {
    const plugins = await listLocalPlugins();
    if (selectedSetFor(config, plugins).size === 0) return;
    const built = await selectedManifest(config, plugins);
    if (built.digest === config.lastPushedDigest) return;
    activeOperation = 'auto-push';
    try {
      const gist = await writeGistPayload(built.manifest, { create: false });
      await writeConfig({
        ...config,
        ...gist,
        lastPushedDigest: built.digest,
        lastPushedAt: new Date().toISOString(),
        lastError: '',
      });
    } finally {
      activeOperation = null;
    }
  } catch (failure) {
    try {
      const latest = await readConfig();
      await writeConfig({
        ...latest,
        lastError: cleanMessage(failure?.message, 'Auto-push failed.'),
      });
    } catch {
      // Best effort.
    }
  } finally {
    autoTickRunning = false;
  }
}

export function startAutoPush(intervalMs = 15_000) {
  if (autoPushTimer) return () => stopAutoPush();
  autoPushTimer = setInterval(() => {
    autoPushTick().catch(() => {});
  }, intervalMs);
  autoPushTimer.unref?.();
  return () => stopAutoPush();
}

export function stopAutoPush() {
  if (autoPushTimer) clearInterval(autoPushTimer);
  autoPushTimer = null;
}
