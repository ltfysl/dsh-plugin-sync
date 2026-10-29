window.__ModuleLoader__.load({
  id: '@local/dsh-plugin-sync',
  factory(require) {
    const React = require('react');
    const {
      createElement: h,
      useEffect,
      useRef,
      useState,
    } = React;

    const NS = 'pluginSync';
    const PANEL_ID = 'plugin-sync';
    const API_BASE = '/plugin-sync';

    const DICT = {
      panel: 'Plugin Sync',
      title: 'Plugin Sync',
      subtitle: 'Keep linked local Harness plugins in one secret GitHub gist.',
      gist: 'Gist',
      gistHint: 'Connect a gist created by Plugin Sync, or create a new secret gist.',
      gistPlaceholder: 'https://gist.github.com/... or gist id',
      useGist: 'Use gist',
      createGist: 'Create gist',
      push: 'Push',
      pull: 'Pull',
      copyLink: 'Copy link',
      openGist: 'Open',
      noGist: 'No gist connected',
      autoPush: 'Auto-push',
      autoPushHint: 'Push whenever selected plugin files change.',
      autoPushNeedsGist: 'Connect a gist before enabling auto-push.',
      account: 'GitHub',
      lastPush: 'Last push',
      never: 'Never',
      statusSynced: 'Synced',
      statusDirty: 'Local changes',
      statusNoGist: 'Not connected',
      localPlugins: 'Local plugins',
      localPluginsHint: 'Only linked @local plugins are listed. The sync plugin itself is excluded.',
      selectedCount: '{count} selected',
      selectAll: 'Select all',
      clearAll: 'Clear',
      noPlugins: 'No linked @local plugins found.',
      fileCount: '{count} files',
      loading: 'Loading Plugin Sync…',
      retry: 'Retry',
      reload: 'Reload',
      syncError: 'Plugin sync failed.',
      savedGist: 'Gist connected.',
      created: 'Gist created and plugins pushed.',
      pushed: 'Plugins pushed.',
      pulled: 'Plugins pulled.',
      copied: 'Gist link copied.',
      copyError: 'Could not copy the link.',
      pullTitle: 'Pull plugins?',
      pullBody: 'Missing plugins are installed as managed copies under ~/.dsh/plugin-sync/plugins, added to this profile, and pnpm install runs. Restart DSH afterwards.',
      pullOverwrite: 'Replace existing plugins with the gist versions',
      pullOverwriteHint: 'This repoints existing profile links to the managed copies.',
      pullCancel: 'Cancel',
      pullConfirm: 'Pull plugins',
      pulling: 'Pulling…',
      creating: 'Creating…',
      pushing: 'Pushing…',
      saving: 'Saving…',
      installedCount: '{count} installed',
      skippedCount: '{count} skipped',
      pullRestart: 'Restart DeepSeek Harness to load the pulled plugins.',
      pullPnpmWarning: 'pnpm install reported a problem.',
      pullEmpty: 'No new plugins were installed. Existing plugins were skipped.',
      busy: 'Syncing…',
      close: 'Close',
      localOnly: 'The gist is secret unless you changed it on GitHub. Plugin code is never executed during push or pull.',
      selected: 'Selected',
      selectionSaved: 'Selection saved.',
      configSaved: 'Setting saved.',
      gistInvalid: 'Enter a gist URL or gist id.',
      pullUnavailable: 'Connect a gist before pulling.',
      pushUnavailable: 'Connect a gist before pushing.',
      autoPushSaved: 'Auto-push updated.',
    };

    const DE_DICT = {
      panel: 'Plugin Sync',
      title: 'Plugin Sync',
      subtitle: 'Verlinkte lokale Harness-Plugins in einem geheimen GitHub-Gist sichern.',
      gist: 'Gist',
      gistHint: 'Verbinde einen von Plugin Sync erstellten Gist oder erstelle einen neuen geheimen Gist.',
      gistPlaceholder: 'https://gist.github.com/... oder Gist-ID',
      useGist: 'Gist verwenden',
      createGist: 'Gist erstellen',
      push: 'Push',
      pull: 'Pull',
      copyLink: 'Link kopieren',
      openGist: 'Öffnen',
      noGist: 'Kein Gist verbunden',
      autoPush: 'Auto-Push',
      autoPushHint: 'Automatisch pushen, wenn sich ausgewählte Plugin-Dateien ändern.',
      autoPushNeedsGist: 'Verbinde zuerst einen Gist, um Auto-Push zu aktivieren.',
      account: 'GitHub',
      lastPush: 'Letzter Push',
      never: 'Nie',
      statusSynced: 'Synchron',
      statusDirty: 'Lokale Änderungen',
      statusNoGist: 'Nicht verbunden',
      localPlugins: 'Lokale Plugins',
      localPluginsHint: 'Nur verlinkte @local-Plugins werden angezeigt. Das Sync-Plugin selbst ist ausgeschlossen.',
      selectedCount: '{count} ausgewählt',
      selectAll: 'Alle auswählen',
      clearAll: 'Keine',
      noPlugins: 'Keine verlinkten @local-Plugins gefunden.',
      fileCount: '{count} Dateien',
      loading: 'Plugin Sync wird geladen…',
      retry: 'Erneut versuchen',
      reload: 'Neu laden',
      syncError: 'Plugin Sync ist fehlgeschlagen.',
      savedGist: 'Gist verbunden.',
      created: 'Gist erstellt und Plugins gepusht.',
      pushed: 'Plugins gepusht.',
      pulled: 'Plugins gepullt.',
      copied: 'Gist-Link kopiert.',
      copyError: 'Der Link konnte nicht kopiert werden.',
      pullTitle: 'Plugins pullen?',
      pullBody: 'Fehlende Plugins werden als verwaltete Kopien unter ~/.dsh/plugin-sync/plugins installiert, diesem Profil hinzugefügt und pnpm install ausgeführt. Danach DSH neu starten.',
      pullOverwrite: 'Vorhandene Plugins durch die Gist-Versionen ersetzen',
      pullOverwriteHint: 'Dadurch zeigen vorhandene Profil-Links auf die verwalteten Kopien.',
      pullCancel: 'Abbrechen',
      pullConfirm: 'Plugins pullen',
      pulling: 'Wird gepullt…',
      creating: 'Wird erstellt…',
      pushing: 'Wird gepusht…',
      saving: 'Wird gespeichert…',
      installedCount: '{count} installiert',
      skippedCount: '{count} übersprungen',
      pullRestart: 'DeepSeek Harness neu starten, um die gepullten Plugins zu laden.',
      pullPnpmWarning: 'pnpm install hat ein Problem gemeldet.',
      pullEmpty: 'Keine neuen Plugins installiert. Vorhandene Plugins wurden übersprungen.',
      busy: 'Synchronisierung läuft…',
      close: 'Schließen',
      localOnly: 'Der Gist ist geheim, sofern du ihn auf GitHub nicht geändert hast. Plugin-Code wird beim Push oder Pull nie ausgeführt.',
      selected: 'Ausgewählt',
      selectionSaved: 'Auswahl gespeichert.',
      configSaved: 'Einstellung gespeichert.',
      gistInvalid: 'Gist-URL oder Gist-ID eingeben.',
      pullUnavailable: 'Verbinde zuerst einen Gist, um zu pullen.',
      pushUnavailable: 'Verbinde zuerst einen Gist, um zu pushen.',
      autoPushSaved: 'Auto-Push aktualisiert.',
    };

    const CSS = `
.ps-root,.ps-root *{box-sizing:border-box}
.ps-root{width:100%;max-width:980px;margin:0 auto;padding:calc(var(--dsh-frame-top-clearance,0px) + 24px) 24px 48px;color:var(--dsw-alias-label-primary)}
.ps-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.ps-heading{min-width:0}
.ps-title{display:flex;align-items:center;gap:8px;margin:0;font-size:20px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
.ps-subtitle{margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;max-width:620px}
.ps-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ps-card{margin-top:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.ps-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px 13px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.ps-card-title{display:flex;align-items:center;gap:7px;margin:0;font-size:13px;font-weight:600;line-height:1.3}
.ps-card-body{padding:13px}
.ps-muted{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}
.ps-mono{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.ps-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ps-gist-form{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.ps-input{flex:1 1 280px;min-width:0;height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.ps-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:1}
.ps-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.ps-btn:hover{border-color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.ps-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.ps-btn:disabled{opacity:.5;cursor:not-allowed}
.ps-btn-primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand,var(--dsw-alias-bg-base))}
.ps-btn-primary:hover{background:var(--dsw-alias-brand-primary);opacity:.9}
.ps-btn-small{height:28px;padding:0 8px}
.ps-btn-icon{width:34px;padding:0}
.ps-chip{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:0 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.2}
.ps-chip-ok{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,var(--dsw-alias-border-l1))}
.ps-chip-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,var(--dsw-alias-border-l1))}
.ps-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.ps-meta{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:9px;color:var(--dsw-alias-label-secondary);font-size:12px}
.ps-divider{width:1px;height:12px;background:var(--dsw-alias-border-l1)}
.ps-toggle{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1);cursor:pointer}
.ps-toggle input{width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.ps-toggle-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.ps-toggle-label{font-size:12px;font-weight:500}
.ps-toggle-hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4}
.ps-plugin-list{display:flex;flex-direction:column}
.ps-plugin{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:9px;align-items:start;padding:11px 13px;border-top:1px solid var(--dsw-alias-border-l1)}
.ps-plugin:first-child{border-top:0}
.ps-plugin input{width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.ps-plugin-main{min-width:0}
.ps-plugin-name{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12.5px;font-weight:500;line-height:1.35}
.ps-plugin-version{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:400}
.ps-plugin-path{margin-top:3px;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
.ps-plugin-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:12px}
.ps-plugin-state{align-self:center;color:var(--dsw-alias-label-secondary);font-size:12px}
.ps-empty{padding:24px 14px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.ps-banner{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding:9px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.45}
.ps-banner-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-label-primary)}
.ps-banner-copy{min-width:0;flex:1}
.ps-skeleton{display:flex;flex-direction:column;gap:9px;margin-top:18px}
.ps-skel-line{height:12px;border-radius:4px;background:var(--dsw-alias-bg-layer-2)}
.ps-skel-card{height:100px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.ps-toast{position:fixed;right:22px;bottom:calc(var(--dsh-composer-height,0px) + 18px);z-index:40;display:flex;align-items:flex-start;gap:8px;max-width:min(360px,calc(100vw - 32px));padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);font-size:12px;line-height:1.45}
.ps-toast-ok{color:var(--dsw-alias-label-primary)}
.ps-toast-error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.ps-toast-close{margin-left:auto;border:0;background:transparent;color:inherit;font:inherit;font-size:14px;line-height:1;cursor:pointer;padding:0 1px}
.ps-dialog{width:min(560px,calc(100vw - 24px));height:fit-content;max-height:calc(100vh - 48px);padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent)}
.ps-dialog::backdrop{background:color-mix(in srgb,var(--dsw-alias-label-primary) 25%,transparent)}
.ps-dialog-head{display:flex;align-items:flex-start;gap:9px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ps-dialog-glyph{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);flex:none}
.ps-dialog-title{margin:0;font-size:14px;line-height:1.35;font-weight:600}
.ps-dialog-subtitle{margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4}
.ps-dialog-close{margin-left:auto}
.ps-dialog-body{padding:14px 16px;font-size:12px;line-height:1.55}
.ps-dialog-body p{margin:0 0 10px}
.ps-dialog-body p:last-child{margin-bottom:0}
.ps-check{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;cursor:pointer}
.ps-check input{width:14px;height:14px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);flex:none}
.ps-dialog-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:11px 16px;border-top:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.ps-foot{margin-top:14px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.ps-summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
.ps-summary strong{font-weight:600}
@media (max-width: 760px){.ps-root{padding-left:16px;padding-right:16px}.ps-head{align-items:stretch}.ps-head-actions{width:100%}.ps-plugin{grid-template-columns:18px minmax(0,1fr)}.ps-plugin-state{display:none}.ps-gist-form .ps-input{flex-basis:100%}}
@media (pointer: coarse){.ps-btn{height:38px}.ps-input{height:38px}.ps-btn-small{height:32px}}
`;

    function makeError(message, code, status) {
      const error = new Error(message || 'The plugin sync failed.');
      error.code = code || 'SYNC_FAILED';
      error.status = status || 0;
      return error;
    }

    async function request(path, options = {}) {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw makeError(
          payload?.error?.message || `The request failed (${response.status}).`,
          payload?.error?.code || 'SYNC_REQUEST_FAILED',
          response.status,
        );
      }
      return payload;
    }

    function errorMessage(failure, t) {
      return failure?.message || t('syncError');
    }

    async function copyText(value) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Fall back to a temporary textarea.
      }
      try {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.focus();
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
      } catch {
        return false;
      }
    }

    function formatBytes(value) {
      const bytes = Number(value) || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
      return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
    }

    function relativeTime(value, now) {
      if (!value) return '';
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp)) return '';
      const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
      if (seconds < 45) return 'now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }

    function useT(translate) {
      const [, force] = useState(0);
      useEffect(() => {
        if (typeof translate?.subscribe !== 'function') return undefined;
        return translate.subscribe(() => force((value) => value + 1));
      }, [translate]);
      if (typeof translate === 'function') return translate;
      return (key, params) => {
        const template = DICT[key] ?? key;
        return String(template).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? `{${name}}`));
      };
    }

    function useNow(interval = 30_000) {
      const [now, setNow] = useState(() => Date.now());
      useEffect(() => {
        const handle = window.setInterval(() => setNow(Date.now()), interval);
        return () => window.clearInterval(handle);
      }, [interval]);
      return now;
    }

    function Icon({ size = 16, children }) {
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, children);
    }

    function CloudIcon({ size = 16 }) {
      return h(Icon, { size },
        h('path', { d: 'M7 18h9a4 4 0 0 0 .7-7.94A6 6 0 0 0 5.2 9.1 4.5 4.5 0 0 0 7 18Z' }),
        h('path', { d: 'M9 13h6' }),
        h('path', { d: 'm12 10 3 3-3 3' }));
    }

    function AlertIcon({ size = 15 }) {
      return h(Icon, { size },
        h('path', { d: 'M12 3 2.7 19a1.3 1.3 0 0 0 1.1 2h16.4a1.3 1.3 0 0 0 1.1-2Z' }),
        h('path', { d: 'M12 9v4' }),
        h('path', { d: 'M12 17h.01' }));
    }

    function CheckIcon({ size = 15 }) {
      return h(Icon, { size }, h('path', { d: 'm4 12 5 5L20 6' }));
    }

    function Toast({ notice, t, onDismiss }) {
      if (!notice) return null;
      const error = notice.tone === 'error';
      return h('div', {
        className: `ps-toast${error ? ' ps-toast-error' : ' ps-toast-ok'}`,
        role: error ? 'alert' : 'status',
      },
        error ? h(AlertIcon, { size: 14 }) : h(CheckIcon, { size: 14 }),
        h('span', null, notice.text),
        h('button', {
          type: 'button',
          className: 'ps-toast-close',
          onClick: onDismiss,
          'aria-label': t('close'),
          title: t('close'),
        }, '×'));
    }

    function PullDialog({ t, busy, overwrite, onOverwrite, onClose, onConfirm }) {
      const dialogRef = useRef(null);
      useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return undefined;
        if (!dialog.open) dialog.showModal();
        return () => {
          if (dialog.open) dialog.close();
        };
      }, []);
      return h('dialog', {
        ref: dialogRef,
        className: 'ps-dialog',
        'aria-labelledby': 'plugin-sync-pull-title',
        onCancel: (event) => {
          event.preventDefault();
          if (!busy) onClose();
        },
      },
        h('div', { className: 'ps-dialog-head' },
          h('span', { className: 'ps-dialog-glyph' }, h(CloudIcon, { size: 16 })),
          h('div', null,
            h('h2', { className: 'ps-dialog-title', id: 'plugin-sync-pull-title' }, t('pullTitle')),
            h('div', { className: 'ps-dialog-subtitle' }, t('localPlugins'))),
          h('button', {
            type: 'button',
            className: 'ps-btn ps-btn-icon ps-dialog-close',
            onClick: onClose,
            disabled: busy,
            'aria-label': t('close'),
            title: t('close'),
          }, '×')),
        h('div', { className: 'ps-dialog-body' },
          h('p', null, t('pullBody')),
          h('label', { className: 'ps-check' },
            h('input', {
              type: 'checkbox',
              checked: overwrite,
              disabled: busy,
              onChange: (event) => onOverwrite(event.target.checked),
            }),
            h('span', null,
              h('span', { className: 'ps-toggle-label' }, t('pullOverwrite')),
              h('span', { className: 'ps-toggle-hint', style: { display: 'block', marginTop: 2 } }, t('pullOverwriteHint'))))),
        h('div', { className: 'ps-dialog-foot' },
          h('button', { type: 'button', className: 'ps-btn', onClick: onClose, disabled: busy }, t('pullCancel')),
          h('button', {
            type: 'button',
            className: 'ps-btn ps-btn-primary',
            onClick: onConfirm,
            disabled: busy,
            autoFocus: true,
          }, busy ? t('pulling') : t('pullConfirm'))));
    }

    function PluginSyncPanel(props) {
      const t = useT(props.t);
      const now = useNow(30_000);
      const [state, setState] = useState({ status: 'loading', data: null, error: null });
      const [gistInput, setGistInput] = useState('');
      const gistTouchedRef = useRef(false);
      const [pending, setPending] = useState(null);
      const pendingRef = useRef(null);
      const [actionError, setActionError] = useState('');
      const [notice, setNotice] = useState(null);
      const noticeTimer = useRef(0);
      const [pullOpen, setPullOpen] = useState(false);
      const [overwrite, setOverwrite] = useState(false);
      const [pullResult, setPullResult] = useState(null);

      useEffect(() => {
        pendingRef.current = pending;
      }, [pending]);

      useEffect(() => {
        if (!notice) return undefined;
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 4_500);
        return () => window.clearTimeout(noticeTimer.current);
      }, [notice]);

      function notify(text, tone = 'success') {
        setNotice({ text, tone, id: Date.now() });
      }

      async function loadStatus(silent = false) {
        if (!silent) setState((previous) => ({ ...previous, status: 'loading', error: null }));
        try {
          const data = await request('/status');
          setState({ status: 'ready', data, error: null });
          if (!gistTouchedRef.current) {
            setGistInput(data?.gistUrl || data?.gistId || '');
          }
        } catch (failure) {
          setState((previous) => ({
            ...previous,
            status: previous.data ? 'ready' : 'error',
            error: failure,
          }));
        }
      }

      useEffect(() => {
        let active = true;
        async function tick(silent) {
          try {
            const data = await request('/status');
            if (!active) return;
            setState({ status: 'ready', data, error: null });
            if (!gistTouchedRef.current) {
              setGistInput(data?.gistUrl || data?.gistId || '');
            }
          } catch (failure) {
            if (!active) return;
            setState((previous) => ({
              ...previous,
              status: previous.data ? 'ready' : 'error',
              error: failure,
            }));
          }
        }
        tick(false);
        const timer = window.setInterval(() => {
          if (!pendingRef.current) tick(true);
        }, 8_000);
        const onFocus = () => {
          if (!pendingRef.current) tick(true);
        };
        window.addEventListener('focus', onFocus);
        return () => {
          active = false;
          window.clearInterval(timer);
          window.removeEventListener('focus', onFocus);
        };
      }, []);

      async function runAction(name, action, onSuccess) {
        if (pendingRef.current) return;
        setPending(name);
        setActionError('');
        try {
          const data = await action();
          setState({ status: 'ready', data, error: null });
          if (!gistTouchedRef.current) {
            setGistInput(data?.gistUrl || data?.gistId || '');
          }
          onSuccess?.(data);
        } catch (failure) {
          setActionError(errorMessage(failure, t));
          notify(errorMessage(failure, t), 'error');
        } finally {
          setPending(null);
        }
      }

      const data = state.data;
      const busy = Boolean(pending || data?.busy);
      const plugins = data?.plugins ?? [];
      const selected = plugins.filter((plugin) => plugin.selected).map((plugin) => plugin.name);
      const allSelected = plugins.length > 0 && selected.length === plugins.length;
      const statusTone = !data?.gistId ? 'warn' : data?.dirty ? 'warn' : 'ok';
      const statusText = !data?.gistId ? t('statusNoGist') : data?.dirty ? t('statusDirty') : t('statusSynced');
      const gistUrl = data?.gistUrl || '';
      const gistDirtyInput = gistInput.trim() !== (data?.gistUrl || data?.gistId || '').trim();

      function setGist(value) {
        gistTouchedRef.current = true;
        setGistInput(value);
      }

      async function saveGist() {
        if (!gistInput.trim()) {
          notify(t('gistInvalid'), 'error');
          return;
        }
        await runAction('config', () => request('/config', {
          method: 'POST',
          body: { gist: gistInput.trim() },
        }), () => {
          gistTouchedRef.current = false;
          notify(t('savedGist'));
        });
      }

      async function create() {
        await runAction('create', () => request('/create', { method: 'POST', body: {} }), (result) => {
          gistTouchedRef.current = false;
          setPullResult(null);
          notify(t('created'));
          if (result?.gistUrl) setGistInput(result.gistUrl);
        });
      }

      async function push() {
        if (!data?.gistId) {
          notify(t('pushUnavailable'), 'error');
          return;
        }
        await runAction('push', () => request('/push', { method: 'POST', body: {} }), () => {
          notify(t('pushed'));
        });
      }

      async function pull() {
        if (!data?.gistId) {
          notify(t('pullUnavailable'), 'error');
          return;
        }
        setOverwrite(false);
        setPullResult(null);
        setPullOpen(true);
      }

      async function confirmPull() {
        await runAction('pull', () => request('/pull', {
          method: 'POST',
          body: { overwrite },
        }), (result) => {
          setPullOpen(false);
          setPullResult(result);
          notify(t('pulled'));
        });
      }

      async function updateSelection(next) {
        await runAction('selection', () => request('/config', {
          method: 'POST',
          body: { selectedPlugins: next },
        }), () => {
          notify(t('selectionSaved'));
        });
      }

      function togglePlugin(name) {
        const next = selected.includes(name)
          ? selected.filter((entry) => entry !== name)
          : [...selected, name];
        updateSelection(next);
      }

      function toggleAll() {
        updateSelection(allSelected ? [] : plugins.map((plugin) => plugin.name));
      }

      async function toggleAuto() {
        if (!data?.gistId) {
          notify(t('autoPushNeedsGist'), 'error');
          return;
        }
        await runAction('config', () => request('/config', {
          method: 'POST',
          body: { autoPush: !data.autoPush },
        }), () => {
          notify(t('autoPushSaved'));
        });
      }

      async function copyLink() {
        if (!gistUrl) return;
        const copied = await copyText(gistUrl);
        notify(copied ? t('copied') : t('copyError'), copied ? 'success' : 'error');
      }

      if (state.status === 'loading' && !data) {
        return h('div', { className: 'ps-root' },
          h('style', null, CSS),
          h('div', { className: 'ps-skeleton' },
            h('div', { className: 'ps-skel-line', style: { width: '24%' } }),
            h('div', { className: 'ps-skel-line', style: { width: '58%' } }),
            h('div', { className: 'ps-skel-card' }),
            h('div', { className: 'ps-skel-card', style: { height: 180 } })));
      }

      if (state.status === 'error' && !data) {
        return h('div', { className: 'ps-root' },
          h('style', null, CSS),
          h('div', { className: 'ps-head' },
            h('div', { className: 'ps-heading' },
              h('h1', { className: 'ps-title' }, h(CloudIcon, { size: 20 }), t('title')),
              h('p', { className: 'ps-subtitle' }, t('subtitle')))),
          h('div', { className: 'ps-banner', role: 'alert' },
            h(AlertIcon),
            h('div', { className: 'ps-banner-copy' }, h('strong', null, t('syncError')), ' ', errorMessage(state.error, t))),
          h('button', { type: 'button', className: 'ps-btn', onClick: () => loadStatus(false) }, t('retry')));
      }

      return h('div', { className: 'ps-root' },
        h('style', null, CSS),
        h('header', { className: 'ps-head' },
          h('div', { className: 'ps-heading' },
            h('h1', { className: 'ps-title' }, h(CloudIcon, { size: 20 }), t('title')),
            h('p', { className: 'ps-subtitle' }, t('subtitle'))),
          h('div', { className: 'ps-head-actions' },
            h('button', {
              type: 'button',
              className: 'ps-btn',
              onClick: () => loadStatus(false),
              disabled: busy,
            }, t('reload')),
            h('span', { className: `ps-chip ps-chip-${statusTone}` },
              h('span', { className: 'ps-dot' }),
              statusText))),
        actionError
          ? h('div', { className: 'ps-banner', role: 'alert' },
            h(AlertIcon),
            h('div', { className: 'ps-banner-copy' }, actionError))
          : null,
        data?.lastError && !actionError
          ? h('div', { className: 'ps-banner', role: 'alert' },
            h(AlertIcon),
            h('div', { className: 'ps-banner-copy' }, h('strong', null, t('syncError')), ' ', data.lastError))
          : null,
        pullResult
          ? h('div', { className: 'ps-banner ps-banner-ok', role: 'status' },
            h(CheckIcon),
            h('div', { className: 'ps-banner-copy' },
              h('strong', null, t('pulled')),
              h('div', { className: 'ps-summary' },
                h('span', null, h('strong', null, t('installedCount', { count: pullResult.installed?.length ?? 0 }))),
                h('span', null, h('strong', null, t('skippedCount', { count: pullResult.skipped?.length ?? 0 })))),
              pullResult.requiresRestart ? h('div', null, t('pullRestart')) : null,
              pullResult.pnpmWarning ? h('div', null, t('pullPnpmWarning'), ' ', pullResult.pnpmWarning) : null,
              !pullResult.requiresRestart && (pullResult.installed?.length ?? 0) === 0 ? h('div', null, t('pullEmpty')) : null))
          : null,
        h('section', { className: 'ps-card', 'aria-labelledby': 'plugin-sync-gist-title' },
          h('div', { className: 'ps-card-head' },
            h('h2', { className: 'ps-card-title', id: 'plugin-sync-gist-title' }, h(CloudIcon, { size: 15 }), t('gist')),
            data?.account ? h('span', { className: 'ps-chip' }, `${t('account')}: ${data.account}`) : null),
          h('div', { className: 'ps-card-body' },
            h('div', { className: 'ps-gist-form' },
              h('input', {
                type: 'text',
                className: 'ps-input',
                value: gistInput,
                placeholder: t('gistPlaceholder'),
                'aria-label': t('gist'),
                spellCheck: false,
                disabled: busy,
                onChange: (event) => setGist(event.target.value),
              }),
              h('button', {
                type: 'button',
                className: 'ps-btn',
                onClick: saveGist,
                disabled: busy || !gistDirtyInput || !gistInput.trim(),
              }, pending === 'config' ? t('saving') : t('useGist')),
              !data?.gistId
                ? h('button', {
                  type: 'button',
                  className: 'ps-btn ps-btn-primary',
                  onClick: create,
                  disabled: busy || selected.length === 0,
                }, pending === 'create' ? t('creating') : t('createGist'))
                : h('button', {
                  type: 'button',
                  className: 'ps-btn',
                  onClick: copyLink,
                  disabled: busy || !gistUrl,
                }, t('copyLink')),
              data?.gistId
                ? h('a', {
                  className: 'ps-btn',
                  href: gistUrl,
                  target: '_blank',
                  rel: 'noreferrer noopener',
                }, t('openGist'))
                : null),
            h('div', { className: 'ps-meta' },
              data?.gistId ? h('span', { className: 'ps-mono', title: data.gistUrl || data.gistId }, data.gistId) : h('span', null, t('noGist')),
              h('span', { className: 'ps-divider', 'aria-hidden': 'true' }),
              h('span', null, t('lastPush'), ': ', data?.lastPushedAt ? `${relativeTime(data.lastPushedAt, now)}` : t('never')),
              data?.dirty ? h('span', { className: 'ps-chip ps-chip-warn' }, t('statusDirty')) : null),
            h('div', { className: 'ps-row', style: { marginTop: 11 } },
              h('button', {
                type: 'button',
                className: 'ps-btn ps-btn-primary',
                onClick: push,
                disabled: busy || !data?.gistId || selected.length === 0,
              }, pending === 'push' ? t('pushing') : t('push')),
              h('button', {
                type: 'button',
                className: 'ps-btn',
                onClick: pull,
                disabled: busy || !data?.gistId,
              }, pending === 'pull' ? t('pulling') : t('pull'))),
            h('label', { className: 'ps-toggle' },
              h('input', {
                type: 'checkbox',
                checked: Boolean(data?.autoPush),
                disabled: busy || !data?.gistId,
                onChange: toggleAuto,
              }),
              h('span', { className: 'ps-toggle-copy' },
                h('span', { className: 'ps-toggle-label' }, t('autoPush')),
                h('span', { className: 'ps-toggle-hint' }, data?.gistId ? t('autoPushHint') : t('autoPushNeedsGist')))))),
        h('section', { className: 'ps-card', 'aria-labelledby': 'plugin-sync-plugins-title' },
          h('div', { className: 'ps-card-head' },
            h('h2', { className: 'ps-card-title', id: 'plugin-sync-plugins-title' }, t('localPlugins')),
            h('div', { className: 'ps-row' },
              h('span', { className: 'ps-muted' }, t('selectedCount', { count: selected.length })),
              h('button', {
                type: 'button',
                className: 'ps-btn ps-btn-small',
                onClick: toggleAll,
                disabled: busy || plugins.length === 0,
              }, allSelected ? t('clearAll') : t('selectAll')))),
          plugins.length === 0
            ? h('div', { className: 'ps-empty' }, t('noPlugins'))
            : h('div', { className: 'ps-plugin-list' },
              plugins.map((plugin) => h('label', { key: plugin.name, className: 'ps-plugin' },
                h('input', {
                  type: 'checkbox',
                  checked: plugin.selected,
                  disabled: busy,
                  onChange: () => togglePlugin(plugin.name),
                }),
                h('span', { className: 'ps-plugin-main' },
                  h('span', { className: 'ps-plugin-name' },
                    plugin.name,
                    h('span', { className: 'ps-plugin-version' }, `v${plugin.version}`)),
                  h('span', { className: 'ps-plugin-path', title: plugin.directory }, plugin.directory),
                  h('span', { className: 'ps-plugin-meta' },
                    h('span', null, t('fileCount', { count: plugin.files })),
                    plugin.bytes ? h('span', null, formatBytes(plugin.bytes)) : null)),
                h('span', { className: 'ps-plugin-state' }, plugin.selected ? t('selected') : '')))),
        h('p', { className: 'ps-foot' }, t('localOnly')),
        pullOpen
          ? h(PullDialog, {
            t,
            busy: pending === 'pull',
            overwrite,
            onOverwrite: setOverwrite,
            onClose: () => {
              if (pending === 'pull') return;
              setPullOpen(false);
            },
            onConfirm: confirmPull,
          })
          : null,
        h(Toast, { notice, t, onDismiss: () => setNotice(null) })));
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, 'en', DICT), 'plugin-sync: English locale');
      ctx.effect(() => ctx.locale.register(NS, 'de', DE_DICT), 'plugin-sync: German locale');
      const label = () => {
        try {
          return ctx.locale.bind(NS)('panel');
        } catch {
          return DICT.panel;
        }
      };

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 55,
        label,
        locale: NS,
      }, function SidebarIcon({ size = 16 }) {
        return h(Icon, { size },
          h('path', { d: 'M7 18h9a4 4 0 0 0 .7-7.94A6 6 0 0 0 5.2 9.1 4.5 4.5 0 0 0 7 18Z' }),
          h('path', { d: 'M9 13h6' }),
          h('path', { d: 'm12 10 3 3-3 3' }));
      }));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, PluginSyncPanel));
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
