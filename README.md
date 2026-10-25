# kinsite

A static family-tree website generator. Give it a GEDCOM file; get back plain HTML
pages for every person, with a readable family chart, that you can host anywhere.

**Status: planning.** There is no code here yet. This repo exists to collect ideas
as issues while the generator is extracted from a private family project and cleaned
up for publication.

## Goals

- **Static output only.** No server, no database. JavaScript in the browser is fine,
  but every page must be readable without it.
- **Privacy by construction.** The generator filters private data (living people's
  details, contact info, street addresses) at build time. Nothing the browser loads
  is built from the raw GEDCOM.
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
