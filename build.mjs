#!/usr/bin/env node
// Static HTML family-tree site from a GEDCOM file.
//
// Usage:
//   node build.mjs path/to/kinsite.config.json
//   FOCUS=I3 node build.mjs kinsite.config.json   # re-center on another person
//   OUT=/tmp/site node build.mjs kinsite.config.json
//   node build.mjs diff kinsite.config.json old.ged   # what changed on the site since old.ged
//   node build.mjs news stamp kinsite.config.json old.ged   # record this deploy's changes for What's new
import { loadConfig } from './lib/config.mjs'
import { buildSite } from './lib/build.mjs'
import { changeReport } from './lib/diff.mjs'
import { stampNews } from './lib/news.mjs'

const USAGE = `usage: kinsite path/to/kinsite.config.json
       kinsite diff path/to/kinsite.config.json old.ged
       kinsite news stamp path/to/kinsite.config.json old.ged`
const [first, ...rest] = process.argv.slice(2)
const [cmd, file, old] = first === 'diff' ? [first, ...rest]
  : first === 'news' ? (rest[0] === 'stamp' ? ['stamp', ...rest.slice(1)] : [])
  : ['build', first]
if (!file || (cmd !== 'build' && !old)) {
  console.error(USAGE)
  process.exit(2)
}
try {
  if (cmd === 'diff') console.log(changeReport(loadConfig(file), old))
  else if (cmd === 'stamp') stampNews(loadConfig(file), old)
  else buildSite(loadConfig(file, { focus: process.env.FOCUS, out: process.env.OUT }))
} catch (e) {
  console.error(`error: ${e.message}`)
  process.exit(1)
}
