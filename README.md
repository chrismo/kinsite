# kinsite

A static family-tree website generator. Give it a GEDCOM file; get back plain HTML
pages for every person, with a readable family chart, that you can host anywhere.

**Status: early.** The generator works and has tests, but the config format and
output may still change.

## Usage

Needs Node 22 or later; no dependencies. Live demo: https://chrismo.github.io/kinsite/

```sh
node build.mjs sample/kinsite.config.json   # build the fictional sample tree into site/
open site/index.html
npm run dev                                  # preview the sample at http://localhost:4000 (PORT=... to change); rebuilds and reloads on edits
npm test
```

For your own tree, write a `kinsite.config.json` next to your GEDCOM:

```json
{
  "gedcom": "my-tree.ged",
  "title": "My Family Tree",
  "focus": "I1",
  "out": "site",
  "mediaRoot": "."
}
```

| Key               | Meaning                                                                       | Default                |
|-------------------|-------------------------------------------------------------------------------|------------------------|
| `gedcom`          | GEDCOM 7.0 file to read (required)                                            |                        |
| `title`           | Site title on the index page                                                  | `Family Tree`          |
| `focus`           | ID of the person the site centers on: home-page chart and every "Path to ..." | first person           |
| `out`             | Output directory (deleted and rebuilt on each run)                            | `site`                 |
| `mediaRoot`       | Base directory for relative `FILE` paths of photos and documents              | the config's directory |
| `anonymizeLiving` | Show living people only as "Private", for a public site (see Goals)           | `false`                |
| `citations`       | Show source citations on person pages; event notes follow `notes`             | `true`                 |
| `notes`           | Show person and event notes; a citation's own notes go with the citation       | `true`                 |

Relative paths resolve against the config file's directory. `FOCUS=I3` or `OUT=dir` in
the environment override the config for one run. The build log ends by saying what was
published, e.g. `published   : citations shown, notes hidden, living anonymized`.

### A research site or a public site

The defaults suit a **research site**: one you and other researchers reach behind
proper authorization, showing everything the GEDCOM records, living people included.

```json
{
  "gedcom": "my-tree.ged",
  "title": "My Family Tree (research)",
  "out": "site-research"
}
```

A **public site** is for relatives and anyone else to browse without a login: living
people appear only as "Private", and the working notes and citations behind the
research are left out.

```json
{
  "gedcom": "my-tree.ged",
  "title": "My Family Tree",
  "out": "site-public",
  "anonymizeLiving": true,
  "citations": false,
  "notes": false
}
```

Each setting stands alone, so a public site can still show citations or notes. Turning
`citations` or `notes` on never reveals a living person: with `anonymizeLiving`, their
notes and citations are withheld whatever these say.

Everything in `sample/` is invented: names, places, dates, numbers and addresses.

## Facts and their sources

When a GEDCOM records a birth, christening, baptism, death or burial more than once,
the person page shows the versions together, in file order, which GEDCOM 7 uses for
preference: the first shown is marked preferred and the rest alternates. Versions
with nothing to show, and those marked `RESN PRIVACY` or `CONFIDENTIAL`, are left out.
Life spans and the birth-year sort use the first version with a year. With
`anonymizeLiving`, every birth version counts toward deciding who is living,
restricted or not.

Under each event come its notes and citations, numbered: source title, page, and the
quoted text of the record. Citations on the person record or on the name shown are
listed under Sources at the foot of the page. Marriages don't show notes or citations
yet.

## Goals

- **Static output only.** No server, no database. JavaScript in the browser is fine,
  but every page must be readable without it.
- **No contact details.** The build removes phone numbers, email addresses, street
  addresses and PO boxes from places, notes and citations; never reads contact fields (`ADDR`,
  `PHON`, `EMAIL`); and hides events marked `RESN PRIVACY` or `CONFIDENTIAL`.
- **Living people suited to the audience.** By default living people appear as-is,
  which is fine for a site behind proper authorization. For a public site, set
  `"anonymizeLiving": true`: anyone with no `DEAT` event who was born within the last
  100 years, or has no birth date, still appears in the tree but only as "Private",
  with name, sex, dates, places, events, marriages, notes, citations and media withheld and their
  media files not copied. A photo also attached to someone else, such as a group
  photo, is withheld from their page too. Their page stays at the same address and says only "Private".
  Notes on deceased people's records are shown as written, even if they mention a
  living person.
- **A chart that stays readable.** A focused neighborhood around one person, never a
  whole tree shrunk until the text is useless.
- **Works on a phone.**
- **Stable URLs.** A person keeps the same page address across rebuilds.

## Contributing

Ideas, bugs and design notes are welcome as issues. Please don't paste real genealogy
data of living people into an issue; invent a sample instead.

## License

[MIT](LICENSE)
