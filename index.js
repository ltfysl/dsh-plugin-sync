/**
 * Host half of Plugin Sync.
 *
 * The browser gets a small authenticated Web route. All GitHub and pnpm work
 * happens through execFile with an explicit argv, bounded output, and timeouts.
 */
import {
  SyncError,
  createGist,
  getStatus,
  pullGist,
  pushGist,
  startAutoPush,
  updateConfig,
} from './lib/sync.js';

const ROUTE_PREFIX = '/plugin-sync';
const MAX_BODY_BYTES = 64 * 1024;

export const inject = ['webServer', 'connection'];

function sendJson(response, status, value) {
  if (response.headersSent) return;
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function sendEmpty(response, status) {
  if (response.headersSent) return;
  response.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': 0,
  });
  response.end();
}

function failureBody(error) {
  return {
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: error.message || 'The plugin sync failed.',
      ...(error.detail === undefined ? {} : { detail: error.detail }),
    },
  };
}

async function readJsonBody(request) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      throw new SyncError('Request body is too large.', {
        code: 'REQUEST_TOO_LARGE',
        status: 413,
      });
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new SyncError('Request body must be valid JSON.', {
      code: 'INVALID_JSON',
      status: 400,
    });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SyncError('Request body must be a JSON object.', {
      code: 'INVALID_JSON',
      status: 400,
    });
  }
  return parsed;
}

async function dispatch(ctx, request, response, url) {
  const rejection = ctx.connection.requestRejection({ headers: request.headers });
  if (rejection !== undefined) {
    sendEmpty(response, rejection);
    return;
  }
  const method = request.method ?? 'GET';
  if (!url.pathname.startsWith(ROUTE_PREFIX)) {
    sendEmpty(response, 404);
    return;
  }
  const endpoint = url.pathname.slice(ROUTE_PREFIX.length) || '/';

  if (method === 'GET' || method === 'HEAD') {
    if (endpoint === '/status') {
      sendJson(response, 200, await getStatus());
      return;
    }
    sendEmpty(response, 404);
    return;
  }

  if (method === 'POST') {
    const body = await readJsonBody(request);
    if (endpoint === '/config') {
      sendJson(response, 200, await updateConfig({
        gist: body.gist,
        autoPush: body.autoPush,
        selectedPlugins: body.selectedPlugins,
      }));
      return;
    }
    if (endpoint === '/create') {
      sendJson(response, 200, await createGist());
      return;
    }
    if (endpoint === '/push') {
      sendJson(response, 200, await pushGist());
      return;
    }
    if (endpoint === '/pull') {
      sendJson(response, 200, await pullGist({ overwrite: body.overwrite === true }));
      return;
    }
  }
  sendEmpty(response, 404);
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: (request, response) => {
      let url;
      try {
        url = new URL(request.url ?? '/', 'http://localhost');
      } catch {
        sendEmpty(response, 400);
        return;
      }
      dispatch(ctx, request, response, url).catch((error) => {
        const known = error instanceof SyncError;
        if (!known) console.error('[plugin-sync]', error);
        sendJson(response, known ? error.status : 500, failureBody(known ? error : new SyncError(
          'The plugin sync failed unexpectedly.',
          { code: 'INTERNAL_ERROR', status: 500 },
        )));
      });
    },
  }), 'plugin-sync: HTTP routes');

  ctx.effect(() => startAutoPush(15_000), 'plugin-sync: auto push');
}
