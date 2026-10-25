// Contact details recorded in the GEDCOM must never reach the built site.
import fs from 'node:fs'
import path from 'node:path'
import { esc } from './html.mjs'
import { CONTACT } from './redact.mjs'

const PII_TAGS = new Set(['ADDR', 'ADR1', 'POST', 'PHON', 'EMAIL'])
const TEXT_EXT = new Set(['.html', '.css', '.js', '.txt'])

const textFiles = dir => fs.readdirSync(dir, { recursive: true }).sort()
  .filter(f => TEXT_EXT.has(path.extname(f)) && fs.statSync(path.join(dir, f)).isFile())

export function piiValues(gedText) {
  const values = new Set()
  for (const ln of gedText.split(/\r\n?|\n/)) {
    const m = ln.match(/^\d+ (\w+) (.*\S)/)
    if (m && PII_TAGS.has(m[1])) values.add(m[2].trim())
  }
  return [...values]
}

export function findLeaks(values, dir) {
  const leaks = []
  for (const file of textFiles(dir)) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const value of values) {
      if (text.includes(value) || text.includes(esc(value))) leaks.push({ file, value })
    }
  }
  return leaks
}

export function findContactText(dir) {
  return textFiles(dir).flatMap(file =>
    [...fs.readFileSync(path.join(dir, file), 'utf8').matchAll(CONTACT)].map(m => ({ file, value: m[0] })))
}
