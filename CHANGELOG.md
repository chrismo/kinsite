# Changelog

## Unreleased

- **Photos open over the page.** Clicking a photo of one person, or the big
  photo on a photo page, shows it nearly full screen without leaving the page.
  Esc, × or a click outside it closes it. Its footer has the caption and
  buttons to share the image's link, copy it, or open the image in a new tab.

## 0.5.1

- **See a group photo plain.** A photo page has a "Show outlines" box under the
  photo. It starts ticked; untick it to hide the numbered outlines, which can
  crowd a photo of many people.
- **Find someone in a group photo.** On a photo page, hovering a name under "In
  this photo" lights that person's outline and shows their label, even with the
  outlines hidden, and hovering an outline lights the name in the list.
- **A photo's name labels no longer stick after Back.** Clicking a numbered
  outline on a photo page and then going back used to leave that person's name
  showing until something else was clicked. Now a name shows only on hover or
  when the outline is reached with the keyboard. The same goes for the `#` links
  on What's new.

## 0.5.0

- **Identify who's in a photo** with `kinsite dev path/to/kinsite.config.json`, at
  `/who`. Draw a box on each person, see it close up, and search the tree for who
  it is. The search lists the people linked to the photo, then the people alive
  when it was taken. The page gives `OBJE`/`CROP`/`TITL` lines to paste for each
  placed person. Boxes, guesses, unknowns and notes save to `<OBJE id>.json` in a
  `who` folder beside the config, or wherever the new `who` config key says. A crop
  changed in the GEDCOM later updates its box. A session whose photo now has a
  different file is flagged, and isn't saved over until you say its boxes are for
  this photo. The GEDCOM is never written. (#30)
- **`kinsite dev`** runs the dev preview and identify mode from the npm package,
  which now includes the dev server. Before, they were only in a clone of kinsite.
- **Group photos show each person's part.** A `CROP` under a person's `OBJE`
  link shows just that region of a shared photo on their page. The caption gives
  the photo's title with the link's own `TITL` under it, and the alt text reads
  "<name> in <photo title>". No image library and no copies: the size comes from
  the JPEG, PNG, GIF or WebP header (upright, for a JPEG a phone saved sideways)
  and the crop is done in CSS. (#26, #36)
- **A page for each shared photo.** The whole image, with a numbered outline on
  each placed person that shows their name on hover, a list of who's in it, and
  the people linked but not yet placed. Each person's thumbnail links there. (#30)
- **Long URLs wrap on phones.** A long web address in a note or citation used to
  widen the page, so it scrolled sideways on a phone. Now it breaks onto the next
  line. (#40)
- **Link to one deploy.** Each dated heading on What's new has a faint `#` link
  to itself, to copy and share. (#28)

## 0.4.0

- **What's new page.** Set `"news": "news"` in the config and write short
  Markdown entries about each batch of research in that folder, mentioning people
  as `@I12@`. `whats-new.html` shows them newest first, each followed by a
  plain-language list of what changed on the site. The change list is rebuilt on
  every build under that build's privacy settings, so one `news/` folder can feed
  a research site and a public site. (#17)
- **`kinsite news stamp config.json old.ged`** saves the changes since `old.ged`
  at deploy time, so the history doesn't need old GEDCOMs. kinsite never touches
  git; the README gives a deploy recipe. (#17)
- **`kinsite diff config.json old.ged`** prints that change list in the terminal,
  grouped by person, to read before deploying. It stops if the person IDs look
  renumbered. (#16)
- **Preview before deploying.** Build with `SINCE=old.ged` to add a "Not yet
  published" section to What's new. `npm run dev` now takes a config path. (#18)
- **"Updated" note** under a person's name, linking to the latest deploy that
  changed or mentioned them; with `SINCE`, a "Changed since last deploy" link
  too. (#19)
- **Every parent family.** A child listed in more than one family (several
  `FAMC`) used to get the last one as Parents, and the page could contradict
  itself. Now the first `FAMC` not marked `DISPROVEN` is the main family, used by
  Parents, Siblings, the chart and the "Path to" line. The others are listed as
  "Also listed as a child of …", labeled with `PEDI` (adopted, foster, …) and
  `STAT` (challenged, proven, disproven). With `anonymizeLiving`, disproven
  families are left out and Private people show only their main family. (#15)
- **One-sided family links** (a `FAMC` with no matching `CHIL`, or the reverse,
  and the same for spouses) are warned about in the build log. A child link
  recorded on one side still shows on both, labeled "on the family record only"
  or "on the child's record only". (#15)
- **Citations keep their source's ID**, so renaming a source record doesn't
  count as changing every citation to it. (#16)

## 0.3.0

- **Alternate facts.** When a birth, christening, baptism, death or burial is
  recorded more than once, a person page shows every version in file order. The
  first is marked "preferred" and the rest "alternate". Versions with nothing to
  show, or marked private or confidential, are left out. (#10)
- **Event notes and citations.** Notes show under their event. Citations are
  numbered, with source title, page and quoted text. Citations on the person or
  their name go in a Sources list at the foot of the page. Contact details are
  removed from all of these, as from other notes. (#10)
- **Life spans and the birth-year sort** use the first dated version of a birth
  or death that isn't private, so an undated first version no longer hides a
  dated one. (#10)
- **`citations` and `notes` config options**, both on by default. Turn them off
  to hide citations and the Sources list, or person and event notes. A
  citation's own note follows `citations`. The README shows a research-site and
  a public-site config and explains what a public site can still reveal. (#10,
  #12)
- **Config check:** `anonymizeLiving`, `citations` and `notes` must be `true` or
  `false`. A string such as `"false"` is now an error rather than read as on.
- **Build log** says what was hidden, such as `published   : citations hidden,
  notes hidden, living anonymized`.
- **`anonymizeLiving`** now counts every recorded birth when deciding who is
  living, so a private recent birth can't be outweighed by an old alternate.

## 0.2.0

- **`anonymizeLiving` config option.** For public sites: living people stay in the
  tree but appear only as "Private", with their name, dates, places, events,
  notes and media withheld. Their page keeps its address. Photos shared with a
  living person are withheld too. (#7)
- **Sort the people list.** A "Sort by" menu on the home page: name, or birth year
  oldest or newest first. People without a birth year sort last. Without
  JavaScript the list stays A–Z. (#4)
- **Chart first.** The family chart is now at the top of every person page, above
  photos and facts. (#6)
- **Footer link** to the kinsite repo. (#8)
- **Demo site:** the sample tree is published to https://chrismo.github.io/kinsite/
  on every push to main. (#1)
- **`npm run dev`:** a local preview of the sample that rebuilds and reloads on
  change.

## 0.1.0

- First release: GEDCOM 7.0 to static HTML, with a person page for everyone, an
  hourglass chart, contact details removed and a config file.
