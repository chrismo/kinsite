import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { markdown, stampNews, readNews } from '../lib/news.mjs'
import { loadConfig } from '../lib/config.mjs'
import { buildSite } from '../lib/build.mjs'
import { parseGedcom } from '../lib/gedcom.mjs'

// Invented. Ada married Jonas Pell; Tobias and Mara are her parents; Wren is a living granddaughter.
const OLD = `0 @I1@ INDI
1 NAME Ada /Fenwick/
1 SEX F
1 BIRT
2 DATE 1859
2 PLAC Marrowby
1 FAMC @F1@
1 FAMS @F3@
0 @I2@ INDI
1 NAME Tobias /Fenwick/
1 SEX M
1 BIRT
2 DATE 1825
1 DEAT
2 DATE 1890
1 FAMS @F1@
0 @I3@ INDI
1 NAME Mara /Quill/
1 SEX F
1 BIRT
2 DATE 1830
2 PLAC Kettleby
1 FAMS @F1@
0 @I7@ INDI
1 NAME Wren /Fenwick/
1 SEX F
1 BIRT
2 DATE 1990
0 @I9@ INDI
1 NAME Jonas /Pell/
1 SEX M
1 BIRT
2 DATE 1855
1 FAMS @F3@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 @F3@ FAM
1 HUSB @I9@
1 WIFE @I1@
0 TRLR
`
const edit = (ged, from, to) => {
  assert.ok(ged.includes(from), `fixture has ${from}`)
  return ged.replace(from, to)
}

function project({ ged = OLD, news = {}, config = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-news-'))
  fs.writeFileSync(path.join(dir, 'tree.ged'), ged)
  fs.writeFileSync(path.join(dir, 'old.ged'), OLD)
  fs.mkdirSync(path.join(dir, 'news'))
  for (const [f, text] of Object.entries(news)) fs.writeFileSync(path.join(dir, 'news', f), text)
  const file = path.join(dir, 'kinsite.config.json')
  fs.writeFileSync(file, JSON.stringify({ gedcom: 'tree.ged', news: 'news', ...config }))
  const ls = () => fs.readdirSync(path.join(dir, 'news')).sort()
  const read = f => JSON.parse(fs.readFileSync(path.join(dir, 'news', f), 'utf8'))
  const stamp = (today, ged) => {
    if (ged) fs.writeFileSync(path.join(dir, 'tree.ged'), ged)
    return stampNews(loadConfig(file), path.join(dir, 'old.ged'), { today: new Date(today), log: () => {} })
  }
  const build = (overrides = {}) => {
    const lines = []
    buildSite(loadConfig(file, overrides), { log: s => lines.push(s) })
    const out = path.resolve(dir, overrides.out ?? 'site')
    return { lines, page: f => fs.readFileSync(path.join(out, f), 'utf8'), has: f => fs.existsSync(path.join(out, f)) }
  }
  const done = () => fs.rmSync(dir, { recursive: true })
  return { dir, file, ls, read, stamp, build, done, write: (f, t) => fs.writeFileSync(path.join(dir, f), t) }
}

const md = (text, people = {}) => {
  const warnings = []
  const mention = id => (id in people ? people[id] : (warnings.push(id), null))
  return { ...markdown(text, mention), warnings }
}

test('markdown: an optional title line, paragraphs, emphasis and strong', () => {
  const { title, html } = md('# The two Ada Fenwicks\n\nSorted out *two* Adas\nin **Marrowby**.\n\n\nSecond paragraph.\n')
  assert.equal(title, 'The two Ada Fenwicks')
  assert.equal(html, '<p>Sorted out <em>two</em> Adas\nin <strong>Marrowby</strong>.</p><p>Second paragraph.</p>')
  assert.equal(md('No title here.').title, '')
  assert.equal(md('Text\n# Not a title').html, '<p>Text\n# Not a title</p>')
})

test('markdown: only http(s) links become links; bare URLs stop before trailing punctuation', () => {
  assert.equal(md('See [the census](https://example.org/1880?a=1&b=2).').html,
    '<p>See <a href="https://example.org/1880?a=1&amp;b=2">the census</a>.</p>')
  assert.equal(md('See https://example.org/marrowby-1880.').html,
    '<p>See <a href="https://example.org/marrowby-1880">https://example.org/marrowby-1880</a>.</p>')
  assert.equal(md('(http://example.org/x), then').html,
    '<p>(<a href="http://example.org/x">http://example.org/x</a>), then</p>')
  assert.equal(md('[click](javascript:alert(1)) and [f](ftp://example.org)').html,
    '<p>[click](javascript:alert(1)) and [f](ftp://example.org)</p>')
})

test('markdown: anything else, raw HTML included, shows as plain text', () => {
  assert.equal(md('<script>alert("x")</script> ## heading\n- item\n`code`').html,
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; ## heading\n- item\n`code`</p>')
  assert.equal(md('a * b and **unclosed').html, '<p>a * b and **unclosed</p>')
  assert.equal(md('[x](https://example.org/"onmouseover=alert(1))').html,
    '<p><a href="https://example.org/&quot;onmouseover=alert(1">x</a>)</p>')
})

test('markdown: mentions render as the caller says, or are left as written and reported', () => {
  const people = { I1: '<a href="I1.html">Ada Fenwick</a>', I7: 'Private' }
  const { html, warnings } = md('@I1@ married; **@I7@** too; @I99@ is unknown', people)
  assert.equal(html, '<p><a href="I1.html">Ada Fenwick</a> married; <strong>Private</strong> too; @I99@ is unknown</p>')
  assert.deepEqual(warnings, ['I99'])
  assert.equal(md('# About @I1@', people).title, 'About <a href="I1.html">Ada Fenwick</a>')
})

test('markdown: everything passes through redact()', () => {
  assert.equal(md('Write to ada@example.com or call 555-123-4567.').html, '<p>Write to [email] or call [phone].</p>')
})

test('config: news resolves against the config directory and defaults to unset', () => {
  const p = project()
  assert.equal(loadConfig(p.file).news, path.join(p.dir, 'news'))
  p.write('bare.json', JSON.stringify({ gedcom: 'tree.ged' }))
  assert.equal(loadConfig(path.join(p.dir, 'bare.json')).news, null)
  p.write('bad.json', JSON.stringify({ gedcom: 'tree.ged', news: true }))
  assert.throws(() => loadConfig(path.join(p.dir, 'bad.json')), /news must be a directory path/)
  p.done()
})

test('stamp: unstamped entries share one change list; a second deploy on a day gets -2', () => {
  const p = project({ news: { 'two-adas.md': '# Two Adas\n', 'pell-family.md': 'Pells.\n' } })
  const renamed = edit(OLD, '1 NAME Ada /Fenwick/', '1 NAME Ada /Pell/')
  assert.equal(p.stamp('2026-11-14T12:00', renamed), path.join(p.dir, 'news', '2026-11-14.changes.json'))
  const first = p.read('2026-11-14.changes.json')
  assert.deepEqual(first.entries, ['pell-family', 'two-adas'])
  assert.equal(first.date, '2026-11-14')
  assert.deepEqual(first.changes.map(r => [r.kind, r.id]), [['name', 'I1']])

  p.write('news/kit.md', 'Kit.\n')
  p.stamp('2026-11-14T18:00')
  const second = p.read('2026-11-14-2.changes.json')
  assert.deepEqual(second.entries, ['kit'], 'entries already in a changes file are not listed again')
  assert.deepEqual(second.changes, first.changes, 'each stamp diffs against the old.ged it is given')
  assert.equal(fs.readFileSync(path.join(p.dir, 'news', 'kit.md'), 'utf8'), 'Kit.\n', 'narratives are never edited')
  p.done()
})

test('stamp: changes with no entry still make a file; no changes and no entries do nothing', () => {
  const p = project()
  assert.equal(p.stamp('2026-11-14T12:00'), null)
  assert.deepEqual(p.ls(), [])
  p.stamp('2026-11-15T12:00', edit(OLD, '2 DATE 1859', '2 DATE ABT 1858'))
  assert.deepEqual(p.read('2026-11-15.changes.json').entries, [])
  p.done()
})

test('stamp: needs news set in the config', () => {
  const p = project()
  p.write('bare.json', JSON.stringify({ gedcom: 'tree.ged' }))
  assert.throws(() => stampNews(loadConfig(path.join(p.dir, 'bare.json')), path.join(p.dir, 'old.ged'), { log: () => {} }),
    /"news" directory/)
  p.done()
})

test('readNews: deploys newest first, and which entries are not yet stamped', () => {
  const p = project({
    news: {
      'a.md': 'A', 'b.md': 'B', 'c.md': 'C', 'notes.txt': 'ignored',
      '2026-11-14.changes.json': JSON.stringify({ date: '2026-11-14', entries: ['b'], changes: [] }),
      '2026-11-14-2.changes.json': JSON.stringify({ date: '2026-11-14', entries: ['a'], changes: [] }),
      '2026-02-01.changes.json': JSON.stringify({ date: '2026-02-01', entries: [], changes: [] }),
    },
  })
  const news = readNews(path.join(p.dir, 'news'))
  assert.deepEqual(news.deploys.map(d => d.file), ['2026-11-14-2.changes.json', '2026-11-14.changes.json', '2026-02-01.changes.json'])
  assert.deepEqual(news.pending, ['c'])
  assert.deepEqual([...news.entries.keys()], ['a', 'b', 'c'])
  p.done()
})

test('the What\'s new page: deploys newest first, narratives in file-name order, then the change list', () => {
  const p = project({
    news: {
      'two-adas.md': '# The two Ada Fenwicks\n\nSorted out the two Adas. @I1@ is the one who married @I9@; @I7@ helped.\n',
      'pell-family.md': 'More on the Pells; see @I42@.\n',
    },
  })
  const v2 = edit(OLD, '2 DATE 1859', '2 DATE ABT 1858')
  p.stamp('2026-11-14T12:00', v2)
  fs.copyFileSync(path.join(p.dir, 'tree.ged'), path.join(p.dir, 'old.ged'))
  p.stamp('2026-11-20T12:00', edit(v2, '2 DATE 1830', '2 DATE 1831'))
  p.write('news/draft.md', 'Not yet stamped.\n')

  const { lines, page, has } = p.build()
  assert.ok(lines.includes('  news        : 2 deploys, 1 entry not yet stamped'))
  assert.ok(lines.includes('  warning: news pell-family.md: @I42@ is not in the tree'))
  const html = page('whats-new.html')
  assert.match(html, /<title>What&#x27;s new<\/title>/)
  assert.ok(html.indexOf('20 November 2026') < html.indexOf('14 November 2026'), 'newest first')
  assert.ok(html.indexOf('More on the Pells') < html.indexOf('The two Ada Fenwicks'), 'file-name order')
  assert.ok(html.indexOf('The two Ada Fenwicks') < html.indexOf('Changed birth date from 1859 to about 1858'))
  assert.match(html, /<a href="I1\.html">Ada Fenwick<\/a> is the one who married <a href="I9\.html">Jonas Pell<\/a>; <a href="I7\.html">Wren Fenwick<\/a> helped/)
  assert.match(html, /see @I42@\./)
  assert.match(html, /<a href="I3\.html">Mara Quill \(I3\)<\/a><ul><li>Changed birth date from 1830 to 1831<\/li><\/ul>/)
  assert.doesNotMatch(html, /Not yet stamped/)
  assert.match(page('index.html'), /<a href="whats-new\.html">What&#x27;s new<\/a>/)
  assert.ok(has('I1.html'))
  p.done()
})

test('the page is built under this build\'s privacy rules', () => {
  const p = project({ news: { 'wren.md': 'Found @I7@ and @I1@.\n' } })
  const wren = edit(edit(OLD, '2 DATE 1990', '2 DATE 1991'), '2 DATE 1830', '2 DATE 1831')
  p.stamp('2026-11-14T12:00', wren)
  const research = p.build().page('whats-new.html')
  assert.match(research, /Wren Fenwick \(I7\)/)
  const pub = p.build({ anonymizeLiving: true, out: path.join(p.dir, 'public') }).page('whats-new.html')
  assert.doesNotMatch(pub, /Wren|I7\.html/)
  assert.match(pub, /Found Private and <a href="I1\.html">Ada Fenwick<\/a>\./)
  assert.match(pub, /Mara Quill \(I3\)/)
  p.done()
})

test('a person later found to be living, or a fact later marked RESN, drops out of past entries', () => {
  const p = project()
  const v2 = edit(edit(OLD, '1 DEAT\n2 DATE 1890\n', '1 DEAT\n2 DATE 1890\n1 BURI\n2 DATE 1890\n2 PLAC Oak Hill\n'),
    '2 DATE 1830', '2 DATE 1831')
  p.stamp('2026-11-14T12:00', v2)
  const pub = { anonymizeLiving: true }
  assert.match(p.build(pub).page('whats-new.html'), /Added: burial 1890, Oak Hill/)

  p.write('tree.ged', edit(v2, '2 PLAC Oak Hill\n', '2 PLAC Oak Hill\n2 RESN PRIVACY\n'))
  const restricted = p.build(pub).page('whats-new.html')
  assert.doesNotMatch(restricted, /Oak Hill/)
  assert.match(restricted, /Changed birth date to 1831/)

  p.write('tree.ged', edit(v2, '1 BIRT\n2 DATE 1831\n', '1 BIRT\n2 DATE 1960\n'))
  assert.doesNotMatch(p.build(pub).page('whats-new.html'), /Mara/)
  p.done()
})

// Deploy 1 adds Ada's death and her marriage date, and a note on Tobias's death.
const FACTS = edit(edit(edit(OLD, '2 PLAC Marrowby\n', '2 PLAC Marrowby\n1 DEAT\n2 DATE 1920\n2 PLAC Brackenmoor\n'),
  '1 DEAT\n2 DATE 1890\n', '1 DEAT\n2 DATE 1890\n2 NOTE Died at the mill.\n'),
'1 WIFE @I1@\n', '1 WIFE @I1@\n1 MARR\n2 DATE 1880\n2 PLAC Hollin Cross\n')

function stampAll(p, ...geds) {
  for (const ged of geds) {
    p.stamp(`2026-11-${14 + p.ls().length}T12:00`, ged)
    fs.copyFileSync(path.join(p.dir, 'tree.ged'), path.join(p.dir, 'old.ged'))
  }
  return p.build().page('whats-new.html')
}

test('a fact edited and marked RESN in one deploy drops out of the earlier deploys that showed it', () => {
  const p = project()
  const before = stampAll(p, FACTS)
  for (const s of ['death 1920, Brackenmoor', 'Died at the mill', 'Hollin Cross']) assert.ok(before.includes(s), s)
  const restricted = edit(edit(edit(FACTS, '2 DATE 1920\n2 PLAC Brackenmoor\n', '2 DATE 1921\n2 PLAC Brackenmoor\n2 RESN PRIVACY\n'),
    '2 DATE 1890\n2 NOTE Died at the mill.\n', '2 DATE 1890\n2 PLAC Oak Hill\n2 NOTE Died at the mill.\n2 RESN PRIVACY\n'),
  '2 DATE 1880\n2 PLAC Hollin Cross\n', '2 DATE 1881\n2 PLAC Hollin Cross\n2 RESN PRIVACY\n')
  const html = stampAll(p, restricted)
  assert.doesNotMatch(html, /Brackenmoor|1920|Died at the mill|Oak Hill|Hollin Cross|1881/)
  p.done()
})

test('a fact marked RESN and later deleted stays out of the earlier deploys that showed it', () => {
  const p = project()
  const restricted = edit(edit(FACTS, '2 PLAC Brackenmoor\n', '2 PLAC Brackenmoor\n2 RESN PRIVACY\n'),
    '2 PLAC Hollin Cross\n', '2 PLAC Hollin Cross\n2 RESN CONFIDENTIAL\n')
  const deleted = edit(edit(restricted, '1 DEAT\n2 DATE 1920\n2 PLAC Brackenmoor\n2 RESN PRIVACY\n', ''),
    '1 MARR\n2 DATE 1880\n2 PLAC Hollin Cross\n2 RESN CONFIDENTIAL\n', '')
  const html = stampAll(p, FACTS, restricted, deleted)
  assert.doesNotMatch(html, /Brackenmoor|Hollin Cross/)
  assert.match(html, /Died at the mill/, 'other facts still show')
  p.done()
})

test('a deploy with no narrative shows only its date and changes; one with nothing left to show is left off', () => {
  const p = project()
  p.stamp('2026-11-14T12:00', edit(OLD, '2 DATE 1830', '2 DATE 1831'))
  fs.copyFileSync(path.join(p.dir, 'tree.ged'), path.join(p.dir, 'old.ged'))
  p.stamp('2026-11-15T12:00', edit(edit(OLD, '2 DATE 1830', '2 DATE 1831'), '2 DATE 1990', '2 DATE 1991'))
  const research = p.build().page('whats-new.html')
  assert.match(research, /14 November 2026/)
  assert.match(research, /15 November 2026/)
  const pub = p.build({ anonymizeLiving: true }).page('whats-new.html')
  assert.match(pub, /14 November 2026/)
  assert.doesNotMatch(pub, /15 November 2026/)
  p.done()
})

test('hand edits: deleting a record from changes drops that line', () => {
  const p = project()
  p.stamp('2026-11-14T12:00', edit(edit(OLD, '2 DATE 1830', '2 DATE 1831'), '2 DATE 1825', '2 DATE 1824'))
  const f = path.join(p.dir, 'news', '2026-11-14.changes.json')
  const data = JSON.parse(fs.readFileSync(f, 'utf8'))
  data.changes = data.changes.filter(r => r.id !== 'I3')
  fs.writeFileSync(f, JSON.stringify(data))
  const html = p.build().page('whats-new.html')
  assert.match(html, /Tobias Fenwick/)
  assert.doesNotMatch(html, /Mara Quill/)
  p.done()
})

test('a person added and later removed is still named in the earlier deploy, without a link', () => {
  const p = project()
  const kit = edit(OLD, '0 @F1@ FAM', '0 @I8@ INDI\n1 NAME Kit /Fenwick/\n1 BIRT\n2 DATE 1861\n0 @F1@ FAM')
  p.stamp('2026-11-14T12:00', kit)
  fs.copyFileSync(path.join(p.dir, 'tree.ged'), path.join(p.dir, 'old.ged'))
  p.stamp('2026-11-20T12:00', OLD)
  const html = p.build().page('whats-new.html')
  assert.match(html, /<li>Removed: Kit Fenwick \(I8\)<\/li>.*<li>Added: Kit Fenwick \(I8\)<\/li>/)
  p.done()
})

test('a person removed more than once is described from the newest snapshot, so a later living finding hides them', () => {
  const kit = (name, events) => parseGedcom(`0 @I8@ INDI\n1 NAME ${name}\n${events}0 TRLR\n`).indi.get('I8')
  const deploy = (date, changes) => JSON.stringify({ date, entries: [], changes })
  const p = project({
    news: {
      '2026-01-01.changes.json': deploy('2026-01-01', [{ kind: 'person', op: 'removed', id: 'I8',
        was: kit('Kit /Old/', '1 BIRT\n2 DATE 1800\n1 DEAT\n2 DATE 1850\n') }]),
      '2026-02-01.changes.json': deploy('2026-02-01', [{ kind: 'person', op: 'added', id: 'I8' }]),
      '2026-03-01.changes.json': deploy('2026-03-01', [{ kind: 'person', op: 'removed', id: 'I8',
        was: kit('Kit /Living/', '1 BIRT\n2 DATE 1990\n') }]),
    },
  })
  assert.doesNotMatch(p.build({ anonymizeLiving: true }).page('whats-new.html'), /Kit/)
  assert.doesNotMatch(p.build().page('whats-new.html'), /Kit Old/)
  p.done()
})

test('a stamped entry whose file is gone is skipped with a warning', () => {
  const p = project({ news: { 'gone.md': 'Soon gone.\n' } })
  p.stamp('2026-11-14T12:00', edit(OLD, '2 DATE 1830', '2 DATE 1831'))
  fs.rmSync(path.join(p.dir, 'news', 'gone.md'))
  const { lines, page } = p.build()
  assert.ok(lines.includes('  warning: news 2026-11-14.changes.json: gone.md not found'))
  assert.match(page('whats-new.html'), /Mara Quill/)
  p.done()
})

test('with news unset, there is no page, no link and no log line', () => {
  const p = project()
  p.write('bare.json', JSON.stringify({ gedcom: 'tree.ged' }))
  const lines = []
  buildSite(loadConfig(path.join(p.dir, 'bare.json')), { log: s => lines.push(s) })
  assert.ok(!fs.existsSync(path.join(p.dir, 'site', 'whats-new.html')))
  assert.doesNotMatch(fs.readFileSync(path.join(p.dir, 'site', 'index.html'), 'utf8'), /whats-new/)
  assert.ok(!lines.some(l => /^\s+news\s+:/.test(l)))
  p.done()
})

test('a news directory that does not exist yet builds an empty page and is made by the first stamp', () => {
  const p = project()
  fs.rmSync(path.join(p.dir, 'news'), { recursive: true })
  const { lines, page } = p.build()
  assert.ok(lines.includes('  news        : 0 deploys, 0 entries not yet stamped'))
  assert.match(page('whats-new.html'), /Nothing yet/)
  p.stamp('2026-11-14T12:00', edit(OLD, '2 DATE 1830', '2 DATE 1831'))
  assert.deepEqual(p.ls(), ['2026-11-14.changes.json'])
  p.done()
})

const BIN = path.join(path.dirname(new URL(import.meta.url).pathname), '../build.mjs')

test('kinsite news stamp config old.ged writes today\'s changes file', () => {
  const p = project({ ged: edit(OLD, '2 DATE 1830', '2 DATE 1831'), news: { 'mara.md': 'Mara.\n' } })
  const out = execFileSync('node', [BIN, 'news', 'stamp', 'kinsite.config.json', 'old.ged'], { cwd: p.dir, encoding: 'utf8' })
  const [file] = p.ls().filter(f => f.endsWith('.changes.json'))
  assert.match(file, /^\d{4}-\d{2}-\d{2}\.changes\.json$/)
  assert.equal(out, `Wrote news/${file}: 1 entry, 1 change\n`)
  assert.equal(execFileSync('node', [BIN, 'news', 'stamp', 'kinsite.config.json', 'tree.ged'], { cwd: p.dir, encoding: 'utf8' }),
    'Nothing to stamp: no changes and no new entries.\n')
  assert.ok(!fs.existsSync(path.join(p.dir, 'site')), 'stamping builds nothing')
  p.done()
})
