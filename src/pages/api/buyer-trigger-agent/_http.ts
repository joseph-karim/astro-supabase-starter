import type { APIRoute } from 'astro';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function jsonResponse(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(payload), { ...init, headers });
}

export async function parseJsonBody(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return await request.json();
  }
  const raw = await request.text();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function requestId() {
  try {
    const uuid = (globalThis.crypto as any)?.randomUUID?.();
    if (uuid) return uuid;
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const OPTIONS_OK: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

