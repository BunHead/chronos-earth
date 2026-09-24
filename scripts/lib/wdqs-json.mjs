/**
 * wdqs-json.mjs — read a Wikidata Query Service response without losing it to
 * one bad byte.
 *
 * WHY. On 24 Sept 2026 the harvest's city query came back with 3.5 MB of good
 * answers and was thrown away whole: "Bad control character in string literal
 * in JSON at position 3553852". Somewhere in ten thousand labels one editor had
 * typed a raw control character, WDQS passed it through unescaped, and a
 * strict JSON parser rejects the entire document for it. The globe lost every
 * city that night because of one invisible character in one name.
 *
 * Raw control characters (U+0000–U+001F) are never legal inside a JSON
 * string, and outside strings the only legal ones are whitespace. Replacing
 * every one of them with a plain space therefore turns an invalid document
 * into a valid one and cannot change the meaning of a valid one.
 */
export function parseWdqs(text) {
  // eslint-disable-next-line no-control-regex
  return JSON.parse(text.replace(/[\u0000-\u001F]/g, ' '));
}

/** Bindings from a fetch Response, via parseWdqs. */
export async function wdqsBindings(res) {
  return parseWdqs(await res.text()).results.bindings;
}
