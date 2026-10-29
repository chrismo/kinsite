// Site config: a JSON file whose relative paths resolve against its own directory.
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_TITLE } from './render.mjs'

export const DEFAULTS = {
  title: DEFAULT_TITLE,
  focus: null,
  out: 'site',
  mediaRoot: '.',
  anonymizeLiving: false,
  citations: true,
  notes: true,
}
const PATHS = ['gedcom', 'out', 'mediaRoot']
const FLAGS = ['anonymizeLiving', 'citations', 'notes']

export function loadConfig(file, overrides = {}) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const k of Object.keys(raw)) {
    if (k !== 'gedcom' && !(k in DEFAULTS)) throw new Error(`unknown config key: ${k} (in ${file})`)
  }
  const set = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined))
  const c = { ...DEFAULTS, ...raw, ...set }
  if (!c.gedcom) throw new Error(`config needs a "gedcom" path (in ${file})`)
  for (const k of FLAGS) {
    if (typeof c[k] !== 'boolean') throw new Error(`${k} must be true or false, not ${JSON.stringify(c[k])} (in ${file})`)
  }
  const base = path.dirname(path.resolve(file))
  for (const k of PATHS) c[k] = path.resolve(base, c[k])
  return c
}
