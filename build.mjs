#!/usr/bin/env node
// Static HTML family-tree site from a GEDCOM file.
//
// Usage:
//   node build.mjs path/to/kinsite.config.json
//   FOCUS=I3 node build.mjs kinsite.config.json   # re-center on another person
//   OUT=/tmp/site node build.mjs kinsite.config.json
//   SINCE=old.ged node build.mjs kinsite.config.json   # preview unstamped news on What's new
//   node build.mjs diff kinsite.config.json old.ged   # what changed on the site since old.ged
//   node build.mjs news stamp kinsite.config.json old.ged   # record this deploy's changes for What's new
//   node build.mjs dev kinsite.config.json   # preview at localhost, rebuilt on change; /who places people in photos
import { loadConfig } from './lib/config.mjs'
import { buildSite } from './lib/build.mjs'
import { changeReport } from './lib/diff.mjs'
import { stampNews } from './lib/news.mjs'

const USAGE = `usage: kinsite path/to/kinsite.config.json
       kinsite diff path/to/kinsite.config.json old.ged
       kinsite news stamp path/to/kinsite.config.json old.ged
       kinsite dev path/to/kinsite.config.json`
const [first, ...rest] = process.argv.slice(2)
const [cmd, file, old] = first === 'diff' ? [first, ...rest]
  : first === 'dev' ? [first, rest[0]]
  : first === 'news' ? (rest[0] === 'stamp' ? ['stamp', ...rest.slice(1)] : [])
  : ['build', first]
if (!file || (cmd !== 'build' && cmd !== 'dev' && !old)) {
  console.error(USAGE)
  process.exit(2)
}
if (cmd === 'dev') {
  process.argv = [...process.argv.slice(0, 2), file]
  await import('./scripts/dev.mjs')
} else {
  try {
    if (cmd === 'diff') console.log(changeReport(loadConfig(file), old))
    else if (cmd === 'stamp') stampNews(loadConfig(file), old)
    else buildSite(loadConfig(file, { focus: process.env.FOCUS, out: process.env.OUT }), { since: process.env.SINCE })
  } catch (e) {
    console.error(`error: ${e.message}`)
    process.exit(1)
  }
}
