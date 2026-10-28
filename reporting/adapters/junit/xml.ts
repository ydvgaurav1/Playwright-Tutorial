/**
 * Dependency-free XML reader for JUnit result documents.
 *
 * It intentionally supports the subset used by JUnit XML producers: elements,
 * attributes, text, CDATA, comments, processing instructions, a DOCTYPE, and
 * the five predefined entities plus numeric character references. It is not a
 * general-purpose validating XML processor.
 */

export type XmlElement = {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** Direct text and CDATA content, with entities decoded. */
  text: string;
};

export class XmlParseError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(`${message} at offset ${position}`);
    this.name = "XmlParseError";
    this.position = position;
  }
}

export function parseXml(source: string): XmlElement {
  const length = source.length;
  let index = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const document: XmlElement = {
    name: "#document",
    attributes: {},
    children: [],
    text: "",
  };
  const stack: XmlElement[] = [document];
  let text = "";

  const flushText = (): void => {
    if (!text) return;
    stack[stack.length - 1].text += decodeEntities(text);
    text = "";
  };

  while (index < length) {
    if (source[index] !== "<") {
      text += source[index];
      index += 1;
      continue;
    }

    if (source.startsWith("<!--", index)) {
      flushText();
      index = skipUntil(source, index + 4, "-->", "Unterminated comment");
      continue;
    }

    if (source.startsWith("<![CDATA[", index)) {
      const end = source.indexOf("]]>", index + 9);
      if (end < 0) {
        throw new XmlParseError("Unterminated CDATA section", index);
      }
      stack[stack.length - 1].text += source.slice(index + 9, end);
      index = end + 3;
      continue;
    }

    if (source.startsWith("<?", index)) {
      flushText();
      index = skipUntil(
        source,
        index + 2,
        "?>",
        "Unterminated processing instruction",
      );
      continue;
    }

    if (source.startsWith("<!", index)) {
      flushText();
      index = skipDeclaration(source, index);
      continue;
    }

    if (source.startsWith("</", index)) {
      flushText();
      const end = source.indexOf(">", index + 2);
      if (end < 0) {
        throw new XmlParseError("Unterminated closing tag", index);
      }
      const closingName = normalizeName(source.slice(index + 2, end).trim());
      const current = stack.pop();
      if (!current || current.name !== closingName) {
        throw new XmlParseError(
          `Unexpected closing tag </${closingName}>`,
          index,
        );
      }
      index = end + 1;
      continue;
    }

    flushText();
    const tagEnd = findTagEnd(source, index + 1);
    if (tagEnd < 0) {
      throw new XmlParseError("Unterminated opening tag", index);
    }

    const raw = source.slice(index + 1, tagEnd);
    const selfClosing = raw.trimEnd().endsWith("/");
    const content = selfClosing ? raw.trimEnd().slice(0, -1) : raw;
    const { name, attributes } = parseTag(content, index);
    const element: XmlElement = { name, attributes, children: [], text: "" };
    stack[stack.length - 1].children.push(element);
    if (!selfClosing) stack.push(element);
    index = tagEnd + 1;
  }

  flushText();

  if (stack.length !== 1) {
    throw new XmlParseError(
      `Unclosed tag <${stack[stack.length - 1].name}>`,
      length,
    );
  }
  if (document.children.length === 0) {
    throw new XmlParseError("No root element found", length);
  }
  if (document.children.length > 1) {
    throw new XmlParseError("Multiple root elements are not supported", length);
  }

  return document.children[0];
}

function parseTag(
  content: string,
  position: number,
): { name: string; attributes: Record<string, string> } {
  let index = 0;

  const skipWhitespace = (): void => {
    while (index < content.length && /\s/.test(content[index])) index += 1;
  };

  skipWhitespace();
  const nameStart = index;
  while (index < content.length && !/[\s=/>]/.test(content[index])) {
    index += 1;
  }
  const rawName = content.slice(nameStart, index);
  if (!rawName) {
    throw new XmlParseError("Tag name is missing", position);
  }

  const attributes: Record<string, string> = {};
  while (index < content.length) {
    skipWhitespace();
    if (index >= content.length) break;
    if (content[index] === "/") {
      index += 1;
      continue;
    }

    const attributeStart = index;
    while (index < content.length && !/[\s=/>]/.test(content[index])) {
      index += 1;
    }
    const rawAttributeName = content.slice(attributeStart, index);
    if (!rawAttributeName) {
      index += 1;
      continue;
    }

    skipWhitespace();
    if (content[index] !== "=") {
      // Be tolerant of value-less attributes in hand-written fixtures.
      attributes[normalizeName(rawAttributeName)] = rawAttributeName;
      continue;
    }

    index += 1;
    skipWhitespace();
    const quote = content[index];
    if (quote !== '"' && quote !== "'") {
      const valueStart = index;
      while (index < content.length && !/[\s>]/.test(content[index])) {
        index += 1;
      }
      attributes[normalizeName(rawAttributeName)] = decodeEntities(
        content.slice(valueStart, index),
      );
      continue;
    }

    index += 1;
    const valueStart = index;
    while (index < content.length && content[index] !== quote) index += 1;
    if (index >= content.length) {
      throw new XmlParseError(
        `Unterminated attribute "${rawAttributeName}"`,
        position,
      );
    }
    attributes[normalizeName(rawAttributeName)] = decodeEntities(
      content.slice(valueStart, index),
    );
    index += 1;
  }

  return { name: normalizeName(rawName), attributes };
}

function findTagEnd(source: string, start: number): number {
  let quote = "";

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }

  return -1;
}

function skipUntil(
  source: string,
  start: number,
  terminator: string,
  message: string,
): number {
  const end = source.indexOf(terminator, start);
  if (end < 0) throw new XmlParseError(message, start);
  return end + terminator.length;
}

function skipDeclaration(source: string, start: number): number {
  let bracketDepth = 0;
  let quote = "";

  for (let index = start + 2; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") bracketDepth += 1;
    if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    if (character === ">" && bracketDepth === 0) return index + 1;
  }

  throw new XmlParseError("Unterminated declaration", start);
}

function normalizeName(value: string): string {
  const separator = value.indexOf(":");
  const local = separator >= 0 ? value.slice(separator + 1) : value;
  return local.trim().toLowerCase();
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        return codePoint(Number.parseInt(entity.slice(2), 16), match);
      }
      if (entity.startsWith("#")) {
        return codePoint(Number.parseInt(entity.slice(1), 10), match);
      }

      switch (entity) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default:
          return match;
      }
    },
  );
}

function codePoint(value: number, fallback: string): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    return fallback;
  }
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}
