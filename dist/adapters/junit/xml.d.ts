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
export declare class XmlParseError extends Error {
    readonly position: number;
    constructor(message: string, position: number);
}
export declare function parseXml(source: string): XmlElement;
