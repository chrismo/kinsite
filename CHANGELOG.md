# Changelog

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
