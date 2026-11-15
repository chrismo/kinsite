#!/usr/bin/env node
// Usage: npm run dev [-- path/to/kinsite.config.json]   (default: the sample; SINCE=old.ged previews What's new)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { loadConfig } from '../lib/config.mjs'
import { createServer } from './serve.mjs'

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const here = process.env.INIT_CWD ?? process.cwd()
const configFile = path.resolve(here, process.argv[2] ?? path.join(repo, 'sample', 'kinsite.config.json'))
const since = process.env.SINCE && path.resolve(here, process.env.SINCE)
const env = since ? { ...process.env, SINCE: since } : process.env
const port = Number(process.env.PORT || 4000)
const state = { version: 1 }

function rebuild() {
  try {
    const config = loadConfig(configFile)
    // In-process rebuilds would reuse the cached lib/ modules.
    execFileSync(process.execPath, [path.join(repo, 'build.mjs'), configFile], { env, stdio: ['ignore', 'ignore', 'pipe'] })
    state.version++
    console.log(`built (v${state.version})`)
    return config.out
  } catch (e) {
    console.error(`build failed, serving last good output: ${e.stderr?.toString().trim() || e.message}`)
  }
}

let out = rebuild()
if (!out) process.exit(1)

const server = createServer(() => out, state).listen(port, () => console.log(`http://localhost:${server.address().port}`))

let timer
const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(() => { out = rebuild() ?? out }, 150)
}
const inside = (dir, f) => !path.relative(dir, f).startsWith('..')
const config = loadConfig(configFile)
const watched = [
  [path.join(repo, 'lib'), true], [path.join(repo, 'build.mjs'), false], [path.dirname(configFile), true],
  [path.dirname(config.gedcom), false], [config.news, false], [since && path.dirname(since), false],
]
for (const [p, recursive] of watched) {
  if (!p || !fs.existsSync(p)) continue
  fs.watch(p, { recursive }, (_, f) => {
    if (!f || !inside(out, path.join(p, f))) schedule()
  })
}
