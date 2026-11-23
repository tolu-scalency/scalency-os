// Used on the server and in the browser: the short form of an ID for links and labels.

/** The first 8 characters of an ID, e.g. "f5991866". Anything that isn't an ID is returned as it is. */
export function shortId(id: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8).toLowerCase() : id;
}
