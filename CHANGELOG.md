# Changelog

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
- **Demo site:** the sample tree is published to https://kinsite.chrismo.io on every
  push to main. (#1)
- **`npm run dev`:** a local preview of the sample that rebuilds and reloads on
  change.

## 0.1.0

- First release: GEDCOM 7.0 to static HTML, with a person page for everyone, an
  hourglass chart, contact details removed and a config file.
