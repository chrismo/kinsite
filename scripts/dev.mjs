#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { loadConfig } from '../lib/config.mjs'
import { createServer } from './serve.mjs'

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const configFile = path.join(repo, 'sample', 'kinsite.config.json')
const port = Number(process.env.PORT) || 4000
const state = { version: 1 }

function rebuild() {
  try {
    const config = loadConfig(configFile)
    // In-process rebuilds would reuse the cached lib/ modules.
    execFileSync(process.execPath, [path.join(repo, 'build.mjs'), configFile], { stdio: ['ignore', 'ignore', 'pipe'] })
    state.version++
    console.log(`built (v${state.version})`)
    return config.out
  } catch (e) {
    console.error(`build failed, serving last good output: ${e.stderr?.toString().trim() || e.message}`)
  }
}

let out = rebuild()
if (!out) process.exit(1)

createServer(() => out, state).listen(port, () => console.log(`http://localhost:${port}`))

let timer
const schedule = () => {
  clearTimeout(timer)
  timer = setTimeout(() => { out = rebuild() ?? out }, 150)
}
for (const p of ['lib', 'sample', 'build.mjs']) {
  fs.watch(path.join(repo, p), { recursive: true }, schedule)
}
