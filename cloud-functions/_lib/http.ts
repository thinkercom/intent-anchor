// 统一 HTTP 响应工具：CORS + JSON

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export function readBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>
}
