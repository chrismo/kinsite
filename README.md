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
npm run dev -- my/kinsite.config.json        # the same for your own tree; /who places people in photos (see "Photos")
npx kinsite dev my/kinsite.config.json      # the same, with kinsite installed from npm
node build.mjs diff sample/kinsite.config.json old.ged   # what changed on the site since old.ged (see "What changed")
node build.mjs news stamp kinsite.config.json old.ged    # record a deploy's changes for the What's new page (see "What's new")
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
| `news`            | Directory of What's new entries and stamped changes (see "What's new")        | unset: no page         |
| `who`             | Directory for identify-mode sessions (see "Photos")                           | `who`                  |

Relative paths resolve against the config file's directory. `FOCUS=I3` or `OUT=dir` in
the environment override the config for one run. `SINCE=old.ged` previews unpublished
changes on the What's new page; it is never a config key (see "What's new"). The build log says what was
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

Each setting stands alone, so a public site can still show citations or notes. With
`anonymizeLiving`, a living person's own notes and citations are withheld whatever these
say, but notes and citations on other people's records are shown as written: they can
still name a living relative. A citation's own notes go with the citation, so turning off
only `notes` still publishes them.

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

## Parent families

A person listed as a child in more than one family (several `FAMC`) gets one main
parent family: the first `FAMC` in file order that points at a family in the file and isn't marked
`STAT DISPROVEN`. `PROVEN`
is shown as a label but doesn't reorder anything. Parents, Siblings, the chart and the
"Path to" breadcrumb all use the main family. The other families are listed under
Parents as "Also listed as a child of …", labeled with their `PEDI` (adopted, foster,
birth, or the `PHRASE` of `PEDI OTHER`) and `STAT`; the main family gets a label too
when it has a `PEDI` other than `BIRTH`, or a `STAT`. On those other parents' pages the
child is listed with a pointer to the main parents.

With `anonymizeLiving`, `DISPROVEN` families are left out, and a living person appears
only in their main family, with no `PEDI` or `STAT`.

The build warns about links recorded on one side only, such as a `FAMC` with no
matching `CHIL`, a `CHIL` with no `FAMC`, or the same for `FAMS` and `HUSB`/`WIFE`:
`warning: F2 CHIL @I7@ has no matching FAMC in I7`. A child link recorded on one side
still shows on both, labeled with the side that recorded it ("on the family record only"
or "on the child's record only"), so the child stays in the chart and the "Path to"
line. A child's own `FAMC` comes before a link found only on a family's `CHIL` when
choosing the main family. Add the missing line to the file to clear the label and the
warning.

## Photos

A person's page shows each image linked by an `OBJE` pointer, captioned by the `OBJE`
record's `TITL`, and lists other files as documents. Files are copied into the site as
they are.

**One person in a group photo.** A `CROP` under the person's `OBJE` link marks their
part of a shared image. A `TITL` there adds a line under the photo's title for that
person, and the image's alt text names them, as in "Corwin Quill in The harvest show":

```
0 @I3@ INDI
1 OBJE @O2@
2 CROP
3 TOP 100
3 LEFT 100
3 HEIGHT 180
3 WIDTH 140
2 TITL Corwin, far left
```

The page shows just that region, at most 260px tall. Values
are pixels of the photo as it's shown, upright: for a JPEG that a phone saved sideways
with an Exif orientation, measure the turned picture, the way browsers and photo apps
display it. Sizes are read from JPEG, PNG, GIF and WebP files. A missing `LEFT` or `TOP` is 0, and a missing `WIDTH`
or `HEIGHT` runs to the edge. A crop that runs past the edge is cut off there. If the
size can't be read from the file, or no part of the crop is inside it, the page shows the
whole image. Placing or moving a crop isn't listed on What's new.

**A page for each shared photo.** An image that two or more people link to, or that
anyone has a `CROP` of, gets a page of its own, and each of those people's thumbnails
links to it. The page shows the whole image with a faint numbered outline on each
cropped person; hovering or focusing an outline shows their name and the link's `TITL`,
so a caption like "(unconfirmed)" says how sure the placement is. A "Show outlines"
box under the photo, ticked to start, can be unticked to see the photo plain. Below it, "In this
photo" lists the outlined people by number, left to right, and "Also in this photo (not
yet placed)" lists the people linked without a crop, so readers can see who still needs
a place. With `anonymizeLiving`, a photo shared with a living person is withheld from
everyone, so it has no page.

**Placing people in a photo.** While `npm run dev` (or `kinsite dev`) runs, http://localhost:4000/who lists
every image `OBJE` in the GEDCOM, linked to anyone or not, with how many people are
placed and how many are still to place. Open one to identify who's in it:

- Drag on the photo to draw a box around someone. Drag a box to move it, or its
  corner to resize it.
- Pick a box to see a close-up of it, and search for who it is. The search lists the
  people linked to the photo first, then the people alive in the year it was taken.
  That year comes from the first four-digit number in the `OBJE` title, and you can
  change it on the page.
- An answer can also be "Someone not in the tree" or "Not sure". "This is a guess"
  marks a name you aren't sure of. Each box has a caption, which becomes the link's
  `TITL`, and notes.
- The lists below the photo sort the boxes into placed, guessed, unknown and to place.
  People linked to the photo who have no box yet count as to place.
- "For your GEDCOM" gives the `OBJE` link lines, with `CROP` and `TITL`, for each placed
  person whose link is new or differs from the GEDCOM. Copy them into your genealogy
  app, or under that person's record in the file.

kinsite never writes the GEDCOM. A photo's boxes, answers and notes save as you go to
`<OBJE id>.json` in the config's `who` folder, such as `who/O2.json`. Guesses, unknowns
and notes stay only in that file, and committing it is up to you.

A new session starts from the crops already in the GEDCOM. The session also remembers
the GEDCOM's crops as it last saw them. If you then move or add a crop in your
genealogy app, the next visit takes the new crop for that person's box and says so.
Boxes you've changed and not yet pasted are kept. The session also records the
photo's file. If the `OBJE` with that ID now names a different file, as happens when
an app renumbers IDs on export, the page warns you and saves nothing until you
either move that session aside or say its boxes are for this photo.
The page shows the whole tree, living people included, so it answers only on your
own machine, at `localhost`.

## What changed

Before deploying, `kinsite diff kinsite.config.json old.ged` compares an older GEDCOM
with the config's current one and prints one sentence per change, grouped by person.
It builds nothing and never touches git: getting `old.ged`, from a tag, a backup or
anywhere else, is up to you.

```
Ada Fenwick (I1)
  Changed birth date from 1859 to about 1858
  Added: residence 1880, Marrowby
  Now listed as a child of Tobias Fenwick and Mara Quill
Removed: Jonas Pell (I9) and his marriage to Ada Fenwick
```

It reports what changed on the site, not in the GEDCOM: people and marriages added or
removed, the name shown, events, notes, citations, photos and documents (by `FILE`),
marriage date and place, and parent families with their `PEDI` and `STAT`. A child whose
main parent family changes gets one "Now listed as a child of …" line. Tags the site
doesn't show never appear, and neither do marriage notes and citations.

GEDCOM facts have no IDs, so versions of one event on one person (and one `TYPE`, for
`EVEN`) are matched like this: identical versions are unchanged; the rest are paired in
file order when they share a date or a place, and read as changed; anything left over
was added or removed. A fact whose date and place both changed reads as one removal and
one addition. Notes are matched by text, and citations by source and page, so
retitling a `SOUR` record changes nothing.

The list follows the config's privacy settings, so the same two files can be checked
against a research site and a public site. With `anonymizeLiving`, nothing is said
about a Private person, including links to them, or about media of theirs or media
shared with them; a removed person is named only if they would not be Private; and
removals name only what kind of thing went ("Removed a burial record"), not what it
said. With `notes` or `citations` off, there are no note or citation lines. Versions
marked `RESN PRIVACY` or `CONFIDENTIAL` never appear, and all text is redacted as on
the site.

Most of this rests on xrefs staying the same, as stable URLs already do. If more than
half of `old.ged`'s people are missing from the new file, the command stops with
`error: xrefs look renumbered` rather than reporting the whole tree as removed and
re-added.

## What's new

Set `"news": "news"` in the config to publish a `whats-new.html` page that relatives
can read: what you worked on, in your own words, then what changed on the site, with
links to the people. The index links to it. With `news` unset, nothing changes.

**Entries.** Each `.md` file in the directory is one entry, written while doing the
research. Mention people by xref:

```
# The two Ada Fenwicks

Sorted out the two Adas in Marrowby. @I1@ is the one who married
@I9@; the *other* Ada was her cousin. See https://example.org/marrowby-1880.
```

Entries use a small subset of Markdown: an optional `# Title` first line, paragraphs
separated by a blank line, `*emphasis*`, `**strong**`, `[text](https://…)` links and
bare http(s) URLs, and `@I12@` mentions. Anything else, raw HTML included, shows as
plain text, and only http(s) links become links. All text is redacted as on the site.
A mention links to the person, or reads "Private" with no link when they are Private
in this build; a mention of an xref that isn't in the tree is left as written, and the
build warns. An entry is free text, though: like a note, it can still name a living
person in words, and nothing hides that.

**Stamping a deploy.** `kinsite news stamp kinsite.config.json old.ged` runs the "What
changed" diff between `old.ged` and the config's GEDCOM and writes one file per deploy,
such as `news/2026-11-14.changes.json` (`-2`, `-3`, … for later deploys that day):

```json
{ "date": "2026-11-14", "entries": ["pell-family", "two-adas"], "changes": [ … ] }
```

Every entry not yet listed in a changes file is included, so entries written during one
round of research share one change list. A deploy with changes but no entry still gets a
file, and shows on the page with only its date. With no changes and no new entries, the
command writes nothing. Entries are never edited; whether one is waiting is decided by
the changes files. To drop a line, delete its record from `changes`; to reword
something, say it in an entry.

**The page.** Deploys are listed newest first: the date, the entries in file-name order,
then the change list. The sentences are written at each build from the stored records,
under that build's privacy settings, as `kinsite diff` would, so one `news/` directory
can feed a research site and a public site. A person later found to be living, or a fact
later marked `RESN PRIVACY` or `CONFIDENTIAL`, drops out of past deploys on the next
rebuild, and a deploy left with nothing to show is left off. Entries not yet stamped
aren't shown. The build log says, for example,
`news        : 4 deploys, 2 entries not yet stamped`.

**Previewing the next deploy.** To read the next entry as it will appear, build with
`SINCE` set to the GEDCOM that's live now:

```sh
SINCE=old.ged node build.mjs kinsite.config.json
SINCE=old.ged npm run dev -- kinsite.config.json   # rebuilds as the GEDCOM and the entries change
```

`whats-new.html` then starts with a "Not yet published" section: every entry not yet
stamped, followed by a fresh "What changed" diff between `old.ged` and the config's
GEDCOM, under the same privacy settings as the rest of the page. The build log says
`news        : previewing changes since old.ged`. `SINCE` is only ever an environment
variable, never a config key, so a deploy can't publish the preview by accident; and
with the recipe below (stamp, then build) nothing is pending at deploy anyway.

**Updated notes.** A person page shows "Updated 14 Nov 2026" under the name, linking to
that deploy on the page (`whats-new.html#2026-11-14`). The date is the latest deploy that,
under this build's rules, lists a change under the person or has an entry mentioning
them, so a line that isn't shown can't date-stamp a page. Private people never get the
note, entries not yet stamped don't count, and the note doesn't age out. When building
with `SINCE`, a person changed or mentioned in the preview also gets a "Changed since
last deploy" link to the "Not yet published" section.

**Sharing one deploy.** Each dated heading on What's new has a faint `#` link to
itself, in the left margin (beside the date on a phone), so a reader can copy the link
to one deploy's news and send it to a relative. "Not yet published" has none.

**A deploy recipe.** kinsite never touches git; this is one way to run it:

1. Get the GEDCOM that's live now, as `old.ged`.
2. `kinsite news stamp kinsite.config.json old.ged`
3. Build.
4. Commit `news/`.
5. Deploy.
6. Record the GEDCOM you just deployed as the new live version.

Links to individual facts aren't possible: a fact has no ID that survives a rebuild.
Marriage notes and citations aren't covered, as in "What changed".

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
  Notes and citations on deceased people's records are shown as written, even if they
  mention a living person, unless `notes` and `citations` are off (see "A research site
  or a public site").
- **A chart that stays readable.** A focused neighborhood around one person, never a
  whole tree shrunk until the text is useless.
- **Works on a phone.**
- **Stable URLs.** A person keeps the same page address across rebuilds.
- **Show the file as recorded.** kinsite never adds a relationship or fact the GEDCOM
  doesn't state. When the file contradicts itself or is ambiguous, it shows what each
  record says, labeled where GEDCOM provides labels, and the build log warns. Fixing
  the data is the owner's call, not the generator's.

## Contributing

Ideas, bugs and design notes are welcome as issues. Please don't paste real genealogy
data of living people into an issue; invent a sample instead.

## License

[MIT](LICENSE)
