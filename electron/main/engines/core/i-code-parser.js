'use strict';

/**
 * ICodeParser — contract all code parsers must satisfy.
 *
 * parse(file) receives a single file descriptor:
 *   { name: string, path: string, extension: string, content: string }
 *
 * parse() returns a ParsedFile:
 *   {
 *     name: string,
 *     path: string,
 *     extension: string,
 *     language: string,
 *     classes: string[],
 *     methods: string[],
 *     imports: string[],
 *     exports: string[],
 *     lineCount: number,
 *     parseError: string | null,   // null on success
 *   }
 *
 * Implementations must:
 *   - Never throw — surface errors via parseError field
 *   - Always return a full ParsedFile shape, even on failure
 *   - Not perform I/O (content is provided)
 */
class ICodeParser {
  // eslint-disable-next-line no-unused-vars
  parse(file) {
    throw new Error('ICodeParser.parse() must be implemented by a subclass');
  }

  get name() {
    throw new Error('ICodeParser.name must be implemented by a subclass');
  }
}

module.exports = { ICodeParser };
