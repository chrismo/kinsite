import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

export const RELOAD_SCRIPT = `<script>(()=>{const v=()=>fetch('/__version').then(r=>r.text()).catch(()=>null);let c;v().then(x=>{c=x;setInterval(async()=>{const n=await v();if(n&&c&&n!==c)location.reload();c=n||c},700)})})()</script>`

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

export function resolvePath(root, urlPath) {
  let p
  try { p = decodeURIComponent(urlPath.split('?')[0]) } catch { return null }
  if (p.includes('\0') || p.split(/[\\/]/).includes('..')) return null
  const file = path.resolve(root, '.' + path.posix.normalize('/' + p))
  const rel = path.relative(root, file)
  if (path.isAbsolute(rel) || rel.split(path.sep)[0] === '..') return null
  return file
}

export function createServer(getRoot, state) {
  return http.createServer((req, res) => {
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed')
    if (req.url.split('?')[0] === '/__version') return send(200, String(state.version))
    const root = path.resolve(getRoot())
    let file = resolvePath(root, req.url)
    if (!file) return send(403, 'forbidden')
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
      const ext = path.extname(file).toLowerCase()
      const type = TYPES[ext] ?? 'application/octet-stream'
      const data = fs.readFileSync(file)
      if (ext !== '.html') return send(200, data, type)
      const html = data.toString('utf8')
      send(200, html.includes('</body>') ? html.replace('</body>', RELOAD_SCRIPT + '</body>') : html + RELOAD_SCRIPT, type)
    } catch {
      send(404, 'not found')
    }
  })
}
