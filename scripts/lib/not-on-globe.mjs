// Chronos Earth — harvested rows that are not a place on Earth, by row id.
//
// The harvest now skips a P625 on another globe (wdqs-json.mjs wdqsPoint),
// but rows harvested before that stay in imported/events.json, and the
// fetch scripts only ever ADD. dedupe-places.mjs drops every id listed here
// on each nightly run, so a removed row cannot quietly come back.
//
// Found 26 Oct 2026 by asking Wikidata for the globe of every harvested
// row's P625 (and of its location / birthplace): only one was off Earth.
export const NOT_ON_GLOBE = new Map([
  // Fallen Astronaut — https://www.wikidata.org/wiki/Q1161218
  ['q1161218', 'a sculpture on the Moon (Wikidata P625 is a Moon coordinate)'],
]);
