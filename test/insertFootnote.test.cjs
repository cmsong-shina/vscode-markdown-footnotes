'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { insertFootnote } = require('../src/insertFootnote.cjs');
const { nextNumberedFootnote } = require('../src/tidyFootnotes.cjs');

test('auto number follows the last numbered footnote in document order', () => {
    const original = 'First[^8], second[^3].\n\n[^8]: First\n[^3]: Second';
    assert.equal(nextNumberedFootnote(original), '4');
    const result = insertFootnote(original, 5);
    assert.equal(result.text, 'First[^4][^8], second[^3].\n\n[^8]: First\n[^3]: Second\n\n[^4]: ');
    assert.equal(result.cursorOffset, result.text.length);
});

test('starts numbering at one and ignores numeric markers in code and comments', () => {
    const original = '`[^8]` <!-- [^7] -->\n```\n[^6]: Code\n```';
    assert.equal(nextNumberedFootnote(original), '1');
    assert.equal(insertFootnote('', 0).text, '[^1]\n\n[^1]: ');
});

test('named footnote reuses an existing definition', () => {
    const original = 'Text\n\n[^source]: Source';
    const result = insertFootnote(original, 4, 'source', { reuseDefinition: true });
    assert.equal(result.text, 'Text[^source]\n\n[^source]: Source');
    assert.equal(result.cursorOffset, 'Text[^source]'.length);
});

test('named footnote adds a definition using the document newline', () => {
    const result = insertFootnote('Text\r\n', 4, 'source', { reuseDefinition: true });
    assert.equal(result.text, 'Text[^source]\r\n\r\n[^source]: ');
    assert.equal(result.cursorOffset, result.text.length);
});

test('numeric footnote can follow a named definition', () => {
    const original = 'A[^2]\n\n[^2]: Numbered\n[^name]: Named';
    assert.equal(nextNumberedFootnote(original), '3');
});
