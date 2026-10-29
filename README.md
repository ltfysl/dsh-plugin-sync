# Plugin Sync

Sync linked local Harness plugins through one secret GitHub gist, with manual
push/pull and optional automatic push.

## Requirements

- GitHub CLI (`gh`) authenticated with the `gist` scope.
- The Plugin Sync bundle installed in the active DSH profile.
- Only linked `@local/*` plugins that expose a `dsh` manifest are discovered.

## Usage

Open **Plugin Sync** in the sidebar.

1. Select the local plugins to keep in the gist.
2. Click **Create gist** to create a secret gist and push them, or paste an
   existing gist URL/ID and click **Use gist**.
3. Use **Push** and **Pull** for manual sync.
4. Enable **Auto-push** to push selected plugin changes automatically.

Auto-push checks every 15 seconds while the DSH host is running. It only acts
when auto-push is enabled, a gist is connected, at least one plugin is selected,
and the source digest differs from the last pushed digest.

## Pull behavior

Missing plugins are installed as managed copies:

```
~/.dsh/plugin-sync/plugins/<plugin-slug>
```

The profile `package.json` gets a `link:` dependency and a bundle entry, then
`pnpm install --ignore-scripts` runs. **Restart DSH afterwards.**

Existing profile dependencies are skipped by default. The pull dialog offers an
explicit overwrite option; overwriting repoints the existing profile entry to a
fresh managed copy rather than editing the original development checkout.

The sync plugin itself is never pushed or replaced by a pull. Install it first
on a fresh profile. Profile package edits are backed up next to the file as
`package.json.dsh-plugin-sync.bak`.

## Gist format

The gist contains one file, `dsh-plugin-sync.json`, with a versioned manifest:

```json
{
  "format": "dsh-plugin-sync",
  "version": 1,
  "plugins": [
    {
      "name": "@local/example",
      "version": "1.0.0",
      "files": [{ "path": "index.js", "encoding": "utf8", "content": "..." }]
    }
  ]
}
```

Paths are validated during pull. Absolute paths, `..`, `.git`, `node_modules`
and symlinks are rejected or ignored. Pulled plugins only load after a DSH
restart, and `pnpm install` runs with `--ignore-scripts`.

## Limits and exclusions

- Up to 50 plugins, 400 files per plugin, 2 MB per file, 6 MB per plugin, 8 MB total.
- Excluded: `.git`, `node_modules`, `.env*`, `.npmrc`, `.netrc`, private keys,
  logs, coverage, caches and `.DS_Store`.
- The gist is created as **secret** by default.
- Tokens stay inside the `gh` child process; the browser never sees them.

## Development

```bash
node --test
```

The Host uses authenticated Web routes under `/plugin-sync`; the Client is a
plain `@local/dsh-plugin-sync` bundle with a sidebar panel and main view.
