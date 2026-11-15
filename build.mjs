#!/usr/bin/env node
// Static HTML family-tree site from a GEDCOM file.
//
// Usage:
//   node build.mjs path/to/kinsite.config.json
//   FOCUS=I3 node build.mjs kinsite.config.json   # re-center on another person
//   OUT=/tmp/site node build.mjs kinsite.config.json
//   node build.mjs diff kinsite.config.json old.ged   # what changed on the site since old.ged
import { loadConfig } from './lib/config.mjs'
import { buildSite } from './lib/build.mjs'
import { changeReport } from './lib/diff.mjs'

const USAGE = 'usage: kinsite path/to/kinsite.config.json\n       kinsite diff path/to/kinsite.config.json old.ged'
const [first, ...rest] = process.argv.slice(2)
const diff = first === 'diff'
const [file, old] = diff ? rest : [first]
if (!file || (diff && !old)) {
  console.error(USAGE)
  process.exit(2)
}
try {
  if (diff) console.log(changeReport(loadConfig(file), old))
  else buildSite(loadConfig(file, { focus: process.env.FOCUS, out: process.env.OUT }))
} catch (e) {
  console.error(`error: ${e.message}`)
  process.exit(1)
}
