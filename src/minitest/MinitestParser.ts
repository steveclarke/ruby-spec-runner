import { Position, Range, TextDocument } from 'vscode';

export interface MinitestRegion {
  range: Range;
  name?: string;
};

export class MinitestParser {
  private matcher = /(?:(?:^\s*(?:it|should)\(?\s*(?<title>(['"]).*\2)\)?\s*(?:do|{))|(?:^\s*def\s*(?<unit_def>test_\w+)(?:\(\))?\s*))\s*(?:#.*)?$/;
  private document: TextDocument;

  constructor(document: TextDocument) {
    this.document = document;
  }

  getTestRegions(): MinitestRegion[] {
    const text = this.document.getText();
    const regions: MinitestRegion[] = [];

    text.split('\n').forEach((lineContent, lineNo) => {
      const match = lineContent.match(this.matcher);
      if (match) {
        regions.push({
          range: new Range(new Position(lineNo, 0), new Position(lineNo, lineContent.length)),
          name: match.groups?.title || match.groups?.unitDef
        });
      }
    });

    return regions;
  }
}

export default MinitestParser;
