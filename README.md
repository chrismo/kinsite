# kinsite

A static family-tree website generator. Give it a GEDCOM file; get back plain HTML
pages for every person, with a readable family chart, that you can host anywhere.

**Status: early.** The generator works and has tests, but the config format and
output may still change.

## Usage

Needs Node 22 or later; no dependencies.

```sh
node build.mjs sample/kinsite.config.json   # build the fictional sample tree into site/
open site/index.html
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

| Key | Meaning | Default |
| --- | --- | --- |
| `gedcom` | GEDCOM 7.0 file to read (required) | |
| `title` | Site title on the index page | `Family Tree` |
| `focus` | ID of the person the site centers on: home-page chart and every "Path to ..." | first person |
| `out` | Output directory (deleted and rebuilt on each run) | `site` |
| `mediaRoot` | Base directory for relative `FILE` paths of photos and documents | the config's directory |

Relative paths resolve against the config file's directory. `FOCUS=I3` or `OUT=dir` in
the environment override the config for one run.

Everything in `sample/` is invented: names, places, dates, numbers and addresses.

## Goals

- **Static output only.** No server, no database. JavaScript in the browser is fine,
  but every page must be readable without it.
- **Privacy by construction.** Private data is filtered at build time, and nothing
  the browser loads is built from the raw GEDCOM. Today that means: phone numbers,
  email addresses, street addresses and PO boxes are removed from places and notes;
  contact fields (`ADDR`, `PHON`, `EMAIL`) are never read; and events marked
  `RESN PRIVACY` or `CONFIDENTIAL` are hidden. **Living people are not detected
  yet**: their names and pages still appear. Leave them out of the GEDCOM you build
  from, or at least set `RESN PRIVACY` on their events.
- **A chart that stays readable.** A focused neighbourhood around one person, never a
  whole tree shrunk until the text is useless.
- **Works on a phone.**
- **Stable URLs.** A person keeps the same page address across rebuilds.
- **Config-driven.** Title, focus person and which events to show come from a config
  file, not from the code.

## Contributing

Ideas, bugs and design notes are welcome as issues. Please don't paste real genealogy
data of living people into an issue; invent a sample instead.

## License

[MIT](LICENSE)
