#!/usr/bin/env node
// Static HTML family-tree site from a GEDCOM file.
//
// Usage:
//   node build.mjs path/to/kinsite.config.json
//   FOCUS=I3 node build.mjs kinsite.config.json   # re-center on another person
//   OUT=/tmp/site node build.mjs kinsite.config.json
import { loadConfig } from './lib/config.mjs'
import { buildSite } from './lib/build.mjs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node build.mjs path/to/kinsite.config.json')
  process.exit(2)
}
try {
  buildSite(loadConfig(file, { focus: process.env.FOCUS, out: process.env.OUT }))
} catch (e) {
  console.error(`error: ${e.message}`)
  process.exit(1)
}
