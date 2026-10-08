// Streams the items of one top-level array in a JSON document, without
// holding the document in memory: FINESS publishes a single 540 MB JSON
// object, past what one JavaScript string can hold. Each item is parsed on
// its own, so only one is in memory at a time.
//
//   for await (const item of jsonArrayItems(stream, "pmej")) { ... }

const OPEN_OBJECT = 123; // {
const CLOSE_OBJECT = 125; // }
const OPEN_ARRAY = 91; // [
const CLOSE_ARRAY = 93; // ]
const QUOTE = 34; // "
const BACKSLASH = 92; // \
const COLON = 58; // :

/** Items of the array under `key` in the top-level object, parsed one by one. */
export async function* jsonArrayItems(chunks: AsyncIterable<string | Buffer | Uint8Array>, key: string): AsyncGenerator<unknown> {
  const decoder = new TextDecoder("utf-8");
  let depth = 0;
  let inString = false;
  let escaped = false;
  // A string directly inside the top-level object (a key, or a plain value).
  let topString: string[] | null = null;
  let lastTopString = "";
  let keyMatched = false;
  // Depth of the wanted array once inside it; -1 outside.
  let arrayDepth = -1;
  // Text of the item being read, across chunks.
  let item: string[] | null = null;

  for await (const chunk of chunks) {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    let itemFrom = item ? 0 : -1;
    let stringFrom = topString ? 0 : -1;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (inString) {
        if (escaped) escaped = false;
        else if (code === BACKSLASH) escaped = true;
        else if (code === QUOTE) {
          inString = false;
          if (topString) {
            topString.push(text.slice(stringFrom, index));
            lastTopString = topString.join("");
            topString = null;
            stringFrom = -1;
          }
        }
        continue;
      }
      switch (code) {
        case QUOTE:
          inString = true;
          if (depth === 1) {
            topString = [];
            stringFrom = index + 1;
          }
          break;
        case COLON:
          if (depth === 1) keyMatched = lastTopString === key;
          break;
        case OPEN_OBJECT:
        case OPEN_ARRAY:
          depth += 1;
          if (depth === 2 && code === OPEN_ARRAY && keyMatched) {
            arrayDepth = depth;
            keyMatched = false;
          } else if (arrayDepth >= 0 && depth === arrayDepth + 1) {
            item = [];
            itemFrom = index;
          }
          break;
        case CLOSE_OBJECT:
        case CLOSE_ARRAY:
          if (item && depth === arrayDepth + 1) {
            item.push(text.slice(itemFrom, index + 1));
            const parsed = JSON.parse(item.join(""));
            item = null;
            itemFrom = -1;
            yield parsed;
          } else if (depth === arrayDepth) {
            arrayDepth = -1;
          }
          depth -= 1;
          break;
        default:
          break;
      }
    }
    if (topString && stringFrom >= 0) topString.push(text.slice(stringFrom));
    if (item && itemFrom >= 0) item.push(text.slice(itemFrom));
  }
  if (depth !== 0 || inString) throw new Error("JSON document ended early");
}
