// Cloudflare Pages Function — GET/PUT /api/data (specs/02 §5.2)
// KV 키 = SHA-256(동기화 코드) hex. 키 자체가 비밀이므로 별도 인증 없음.
// 의존성 없이 쓰기 위해 필요한 Cloudflare 타입만 로컬 선언한다.

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

interface Env {
  LH_KV: KVNamespace
}

type PagesFunction<E> = (ctx: { request: Request; env: E }) => Promise<Response> | Response

const KEY_RE = /^[0-9a-f]{64}$/
const MAX_BYTES = 5 * 1024 * 1024 // specs/02 §5.2

function keyOf(request: Request): string | null {
  const key = request.headers.get('X-Sync-Key') ?? ''
  return KEY_RE.test(key) ? key : null
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const key = keyOf(request)
  if (!key) return new Response('{"error":"bad key"}', { status: 400, headers: JSON_HEADERS })
  const doc = await env.LH_KV.get(key)
  if (doc == null) return new Response('{"error":"not found"}', { status: 404, headers: JSON_HEADERS })
  return new Response(doc, { status: 200, headers: JSON_HEADERS })
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const key = keyOf(request)
  if (!key) return new Response('{"error":"bad key"}', { status: 400, headers: JSON_HEADERS })
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_BYTES) {
    return new Response('{"error":"too large"}', { status: 413, headers: JSON_HEADERS })
  }
  try {
    JSON.parse(body)
  } catch {
    return new Response('{"error":"invalid json"}', { status: 400, headers: JSON_HEADERS })
  }
  await env.LH_KV.put(key, body)
  return new Response('{}', { status: 200, headers: JSON_HEADERS })
}
