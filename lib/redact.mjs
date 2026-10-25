// PII stays in the GEDCOM; the site shows places to city level and no contact details.

const EMAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g
const PHONE = /(?:\+?1[-. ])?\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g
const STREET = /#?\b\d{1,5}\s+(?:[A-Z][\w']*\.?\s+){1,3}?(?:St|Ave|Dr|Rd|Blvd|Ct|Ln|Way|Pl|Street|Avenue|Drive|Road|Lane|Trail)\b\.?/g
const BOX = /\b(?:(?:Rt|Route|RR)\.?\s?\d+,?\s+)?(?:HCRT|P\.?\s?O\.?\s?Box|Box)\s?\d+/g
const ZIP = /\b([A-Z]{2}) \d{5}(?:-\d{4})?\b/g

export const CONTACT = new RegExp([EMAIL, PHONE, STREET, BOX].map(r => r.source).join('|'), 'g')

export const redact = s => s
  .replace(EMAIL, '[email]')
  .replace(PHONE, '[phone]')
  .replace(BOX, '[address]')
  .replace(STREET, '[address]')
  .replace(ZIP, '$1 [address]')

export function place(s) {
  const t = s.replace(STREET, '').replace(BOX, '')
  if (t === s && !/^\s*#?\d/.test(s)) return s
  const segs = t.split(',')
  if (!segs[0].trim() || /^\s*#?\d/.test(segs[0])) segs.shift()
  return segs.join(',').replace(/\s{2,}/g, ' ').trim()
}
