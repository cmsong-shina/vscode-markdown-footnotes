'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { insertFootnote, validateFootnoteName } = require('../src/insertFootnote.cjs');
const { nextNumberedFootnote } = require('../src/tidyFootnotes.cjs');

test('auto number is one greater than the largest numbered footnote', () => {
    const original = 'First[^8], second[^3].\n\n[^8]: First\n[^3]: Second';
    assert.equal(nextNumberedFootnote(original), '9');
    const result = insertFootnote(original, 5);
    assert.equal(result.text, 'First[^9][^8], second[^3].\n\n[^8]: First\n[^3]: Second\n\n[^9]: ');
    assert.equal(result.cursorOffset, result.text.length);
});

test('auto number never reuses an existing number', () => {
    // 정의 뒤에 본문이 이어지고 앞 번호를 다시 참조하는 문서
    const reusedReference = 'A[^1] B[^2] C[^3]\n\n[^1]: a\n[^2]: b\n[^3]: c\n\nLater again[^1].\n';
    assert.equal(nextNumberedFootnote(reusedReference), '4');

    // 마지막 정의가 앞 각주를 참조하는 문서
    const crossReference = 'A[^1] B[^2] C[^3]\n\n[^1]: a\n[^2]: b\n[^3]: see [^1]\n';
    assert.equal(nextNumberedFootnote(crossReference), '4');

    // 정의가 번호 순서대로 놓이지 않은 문서
    const unorderedDefinitions = 'A[^5] B[^4]\n\n[^5]: five\n[^4]: four\n';
    assert.equal(nextNumberedFootnote(unorderedDefinitions), '6');
});

test('auto number handles labels beyond the safe integer range', () => {
    assert.equal(nextNumberedFootnote('A[^9007199254740993] B[^2]'), '9007199254740994');
});

test('footnote name validation accepts names the preview renders', () => {
    assert.equal(validateFootnoteName('source'), undefined);
    assert.equal(validateFootnoteName('  my-source_2  '), undefined);
});

test('footnote name validation rejects names the preview cannot render', () => {
    for (const name of ['', '   ', '12', 'my source', 'my\tsource', 'a]b', '[a', 'a\nb']) {
        assert.equal(typeof validateFootnoteName(name), 'string', JSON.stringify(name));
    }
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
