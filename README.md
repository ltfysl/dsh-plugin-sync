# Plugin Sync for DeepSeek Harness

Plugin Sync keeps linked local DSH plugins in one secret GitHub gist. Push from
one machine, pull them into another existing DSH profile, or let auto-push keep
the gist current while DSH is running.

- Select which linked `@local/*` plugins belong in the gist.
- Create a secret gist or connect an existing one.
- Manual **Push** and **Pull** buttons.
- Optional **Auto-push** every 15 seconds when selected source files change.
- Pull installs missing plugins, updates the profile and runs `pnpm install`.
- Choose the GitHub account inside the panel. `ltfysl` is preferred when that
  account is authenticated; otherwise the active `gh` account is used.

## Install in an existing DSH

### Requirements

- An existing DeepSeek Harness installation with plugin support.
- GitHub CLI (`gh`) installed and authenticated:

  ```bash
  gh auth login --scopes gist
  gh auth status
  ```

  `gist` is the only scope Plugin Sync itself needs. The selected account needs
  permission to create and edit the gist.

### From GitHub

1. Open DSH.
2. Go to **Plugins** in the sidebar.
3. Click **Add plugin** and choose **Install a third-party plugin**.
4. Enter the repository address:

   ```text
   https://github.com/ltfysl/dsh-plugin-sync
   ```

5. Install it and enable **Plugin Sync** if DSH asks.
6. Restart DSH if the plugin does not appear immediately.
7. Open **Plugin Sync** in the sidebar.

### From a local checkout

Clone the repository and install the directory through the same dialog:

```bash
git clone https://github.com/ltfysl/dsh-plugin-sync.git
```

Then use **Plugins → Add plugin → Install a third-party plugin** and enter the
absolute path to the cloned directory. This is also the development workflow.

## First sync

1. Pick the GitHub account in the gist card. The default is `ltfysl` when that
   account is authenticated.
2. Select the local plugins to keep in the gist.
3. Click **Create gist**. This creates a secret gist and pushes the selection.
4. Optionally enable **Auto-push**.

A connected gist belongs to the selected account. Switching accounts disconnects
the current gist so it can be created or connected under the new account.

## Set up a new device

Plugin Sync runs inside DSH, so DSH itself must be installed there first — the
plugin cannot install DSH. The DSH CLI ships as the npm package
[`@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh) and needs
Node.js 24.9 or newer. Everything after that is checked for you: open the
Plugin Sync panel and the **Device setup** card appears when something is
missing, with the matching install command for macOS or Windows and a copy
button.

### macOS

1. Install Node.js and the DSH CLI:

   ```bash
   brew install node
   npm install -g @deepseek-ai/dsh
   ```

   (The desktop app alone also works; the CLI is what `dsh` commands below
   use.)

2. In DSH: **Plugins → Add plugin → Install a third-party plugin** and enter
   `https://github.com/ltfysl/dsh-plugin-sync` — or, from a terminal:

   ```bash
   dsh plugin --profile desktop add https://github.com/ltfysl/dsh-plugin-sync
   ```

3. Open the Plugin Sync panel. If the setup card asks for it, run:

   ```bash
   brew install gh && gh auth login --scopes gist
   curl -fsSL https://get.pnpm.dev/install.sh | sh -
   ```

4. Continue with *Pull on another machine* below.

### Windows

1. Install Node.js and the DSH CLI (PowerShell):

   ```powershell
   winget install OpenJS.NodeJS.LTS
   npm install -g @deepseek-ai/dsh
   ```

   (The desktop app alone also works; the CLI is what `dsh` commands below
   use.)

2. In DSH: **Plugins → Add plugin → Install a third-party plugin** and enter
   `https://github.com/ltfysl/dsh-plugin-sync` — or, from PowerShell:

   ```powershell
   dsh plugin --profile desktop add https://github.com/ltfysl/dsh-plugin-sync
   ```

3. Open the Plugin Sync panel. If the setup card asks for it, run in
   PowerShell:

   ```powershell
   winget install --id GitHub.cli
   gh auth login --scopes gist
   irm https://get.pnpm.dev/install.ps1 | iex
   ```

4. Continue with *Pull on another machine* below.

The panel finds `gh` and `pnpm` in their usual install locations (Homebrew,
`~/.local/bin`, PNPM_HOME, nvm, fnm, Volta, asdf, `%LOCALAPPDATA%\pnpm` on
Windows) even when DSH was launched with a minimal `PATH`. If a tool was
installed while DSH was already running, click **Check again** in the setup
card or restart DSH.

## Pull on another machine

1. Install Plugin Sync from this repository first. The plugin does not sync
   itself.
2. Authenticate `gh` with the account that owns the gist.
3. Connect the same gist URL or gist ID.
4. Click **Pull**.
5. Restart DSH.

Missing plugins are installed as managed copies under:

```text
~/.dsh/plugin-sync/plugins/<plugin-slug>
```

The profile `package.json` gets a `link:` dependency and a bundle entry, then
`pnpm install --ignore-scripts` runs. Existing profile dependencies are skipped
by default. The pull dialog offers an explicit overwrite option; overwriting
repoints the existing profile entry to a fresh managed copy rather than editing
the original development checkout.

The sync plugin itself is never pushed or replaced by a pull. Install it once on
a fresh profile, then pull the rest.

## What is synced

Only linked `@local/*` plugins with a `dsh` manifest are discovered.

Excluded:

- `.git`, `node_modules`, `.inspect`, caches and coverage
- `.env*`, `.npmrc`, `.netrc`, private keys and logs
- symlinks

Limits:

- 50 plugins
- 400 files per plugin
- 2 MB per file
- 6 MB per plugin
- 8 MB total

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
and symlinks are rejected or ignored.

## Security

- The gist is created as **secret** by default. Check its visibility on GitHub
  if you change it.
- Plugin source is uploaded to GitHub. Review `.env` files and hardcoded secrets
  before pushing.
- Pushing does not execute plugin code.
- Pulling writes plugin source, runs `pnpm install --ignore-scripts`, and adds
  the plugin to the profile. The pulled code runs after the DSH restart.
- GitHub tokens stay inside the `gh` child process. The browser never sees them.
- Gist commands use the selected account's token without changing the globally
  active `gh` account.

## Updating

Non-official plugins are updated by uninstalling and reinstalling them through
**Plugins**, as noted in the DSH install dialog. If you installed from a local
checkout, pull the repository and reinstall or restart the local bundle.

## Development

```bash
node --test
```

The package is `@local/dsh-plugin-sync` with version `0.3.0`. Its Host half uses
authenticated Web routes under `/plugin-sync`; the Client half is a plain DSH
Web bundle with a sidebar panel and main view.

## Troubleshooting

- **No authenticated account**: run `gh auth login --scopes gist`, then reopen
  the panel.
- **Gist not found after switching accounts**: connect or create the gist under
  the newly selected account.
- **Pull installed plugins but they are missing**: restart DSH. If that does
  not help, `pnpm` may not have been reachable from DSH — install pnpm, then
  pull again; the pull re-links the affected plugins automatically.
- **pnpm warning after pull**: run `pnpm install` manually in the profile
  directory shown by DSH, then restart. DSH launched from the desktop finds
  `pnpm` and `gh` in the usual install locations (`~/.local/bin`, Homebrew,
  version managers) even when they are not on its own `PATH`.
