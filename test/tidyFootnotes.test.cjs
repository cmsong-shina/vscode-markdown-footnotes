'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { tidyFootnotes } = require('../src/tidyFootnotes.cjs');

test('numbers references by appearance and sorts adjacent definitions', () => {
    const input = 'First[^7], then[^2], and again[^7].\n\n[^2]: Second\n\n[^7]: First\n';
    const expected = 'First[^1], then[^2], and again[^1].\n\n[^1]: First\n\n[^2]: Second\n';
    assert.equal(tidyFootnotes(input), expected);
    assert.equal(tidyFootnotes(expected), expected);
});

test('keeps named footnotes and ignores code, comments, and escapes', () => {
    const input = [
        'Text[^9] and [^name] and \\[^8].',
        '`[^7]` <!-- [^6] -->',
        '```md',
        '[^5] and [^5]: Code',
        '```',
        '    [^4]',
        '',
        '[^9]: Definition with `[^3]` and [^name].',
        ''
    ].join('\n');
    assert.equal(tidyFootnotes(input), input.replaceAll('[^9]', '[^1]'));
});

test('keeps definition continuation lines attached while sorting', () => {
    const input = 'A[^20] B[^10]\r\n\r\n[^10]: Ten\r\n    continued\r\n\r\n[^20]: Twenty\r\n    still twenty\r\n';
    const expected = 'A[^1] B[^2]\r\n\r\n[^1]: Twenty\r\n    still twenty\r\n\r\n[^2]: Ten\r\n    continued\r\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('assigns numbers to dangling references and unreferenced definitions without collisions', () => {
    const input = 'Reference[^8].\n\n[^3]: Unused\n[^8]: Used\n';
    const expected = 'Reference[^1].\n\n[^1]: Used\n[^2]: Unused\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('does not move definitions across prose', () => {
    const input = 'A[^5] B[^3]\n\n[^3]: Three\nIntervening text\n[^5]: Five\n';
    const expected = 'A[^1] B[^2]\n\n[^2]: Three\nIntervening text\n[^1]: Five\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('ignores fenced and deeply indented code inside a definition', () => {
    const input = [
        'A[^9]',
        '',
        '[^9]: Text',
        '    ```',
        '    [^8]',
        '    ```',
        '        [^7]',
        '    real reference[^6]',
        '',
        '[^6]: Nested',
        ''
    ].join('\n');
    const expected = input.replaceAll('[^9]', '[^1]').replaceAll('[^6]', '[^2]');
    assert.equal(tidyFootnotes(input), expected);
});

test('sorts definitions without adding a final newline or joining lines', () => {
    assert.equal(tidyFootnotes('A[^8] B[^4]\n\n[^4]: Four\n[^8]: Eight'), 'A[^1] B[^2]\n\n[^1]: Eight\n[^2]: Four');
});

test('numbers a footnote in a nested list before later references', () => {
    const input = '- Parent\n    - Child\n        - Nested[^8]\nNext[^2]\n\n[^8]: Eight\n[^2]: Two';
    const expected = '- Parent\n    - Child\n        - Nested[^1]\nNext[^2]\n\n[^1]: Eight\n[^2]: Two';
    assert.equal(tidyFootnotes(input), expected);
});

test('renumbers references on list item continuation lines indented four spaces', () => {
    const definitions = '\n[^3]: Three\n[^5]: Five\n';
    const tidiedDefinitions = '\n[^1]: Five\n[^2]: Three\n';

    // 마커 폭이 4칸인 목록(`-   `)의 이어지는 줄
    const wideMarker = 'Intro[^5]\n\n-   Some line\n    And sub line[^3]\n';
    const tidiedWideMarker = 'Intro[^1]\n\n-   Some line\n    And sub line[^2]\n';
    assert.equal(tidyFootnotes(wideMarker + definitions), tidiedWideMarker + tidiedDefinitions);

    // 빈 줄 뒤에 이어지는 목록 항목의 둘째 문단
    const secondParagraph = 'Intro[^5]\n\n1. Item\n\n    Child paragraph[^3]\n';
    const tidiedSecondParagraph = 'Intro[^1]\n\n1. Item\n\n    Child paragraph[^2]\n';
    assert.equal(tidyFootnotes(secondParagraph + definitions), tidiedSecondParagraph + tidiedDefinitions);
});

test('keeps labels in sync when definitions are nested in a list item', () => {
    const input = 'A[^5] B[^3]\n\n- Item\n\n    [^3]: Three\n    [^5]: Five\n';
    const expected = 'A[^1] B[^2]\n\n- Item\n\n    [^2]: Three\n    [^1]: Five\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('still ignores code indented past the list item content', () => {
    const input = 'A[^5]\n\n- Item\n\n      [^9]\n\n[^5]: Five\n';
    assert.equal(tidyFootnotes(input), input.replaceAll('[^5]', '[^1]'));
});

test('renumbers a reference on an indented paragraph continuation line', () => {
    const input = 'Some paragraph[^5]\n    continued line[^3]\n\n[^3]: Three\n[^5]: Five\n';
    const expected = 'Some paragraph[^1]\n    continued line[^2]\n\n[^1]: Five\n[^2]: Three\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('ignores indented code that directly follows a heading', () => {
    const input = '# Title[^5]\n    [^9]\n\n[^5]: Five\n';
    assert.equal(tidyFootnotes(input), input.replaceAll('[^5]', '[^1]'));
});

test('treats an unmatched backtick as literal text', () => {
    const input = 'A[^5]\n\nThe ` char. B[^3]\n\nC[^7]\n\n[^5]: Five\n[^3]: Three\n[^7]: Seven\n';
    const expected = 'A[^1]\n\nThe ` char. B[^2]\n\nC[^3]\n\n[^1]: Five\n[^2]: Three\n[^3]: Seven\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('does not pair a backtick with one in the next list item', () => {
    const input = '- Use the ` key[^9]\n- See[^4] and `[^7]`\n\n[^9]: Nine\n[^4]: Four\n';
    const expected = '- Use the ` key[^1]\n- See[^2] and `[^7]`\n\n[^1]: Nine\n[^2]: Four\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('ignores a code span that continues on the next line', () => {
    const input = 'A[^5] `code\n[^9] still code` B[^3]\n\n[^5]: Five\n[^3]: Three\n';
    const expected = 'A[^1] `code\n[^9] still code` B[^2]\n\n[^1]: Five\n[^2]: Three\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('does not treat inline code at the start of a line as a fence', () => {
    const input = 'A[^5]\n\n```x``` inline B[^3]\n\n[^5]: Five\n[^3]: Three\n';
    const expected = 'A[^1]\n\n```x``` inline B[^2]\n\n[^1]: Five\n[^2]: Three\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('treats an unclosed comment opener in prose as literal text', () => {
    const input = 'A[^5]\n\nType <!-- to start B[^3]\n\n[^5]: Five\n[^3]: Three\n';
    const expected = 'A[^1]\n\nType <!-- to start B[^2]\n\n[^1]: Five\n[^2]: Three\n';
    assert.equal(tidyFootnotes(input), expected);
});

test('ignores comments that span lines', () => {
    // 문단 안에서 줄을 넘기는 인라인 주석
    const inline = 'A[^5] <!-- note\n[^9] --> B[^3]\n\n[^5]: Five\n[^3]: Three\n';
    const tidiedInline = 'A[^1] <!-- note\n[^9] --> B[^2]\n\n[^1]: Five\n[^2]: Three\n';
    assert.equal(tidyFootnotes(inline), tidiedInline);

    // 빈 줄과 들여쓴 줄을 포함하는 블록 주석
    const block = '<!--\n\n[^9]\n\n    [^8] -->\n\nA[^5]\n\n[^5]: Five\n';
    assert.equal(tidyFootnotes(block), block.replaceAll('[^5]', '[^1]'));
});

test('renumbers footnotes in nested list items while ignoring indented code', () => {
    const input = [
        '- Outer',
        '    - Middle',
        '        - Nested[^8]',
        '    ```',
        '    [^7]',
        '    ```',
        '    Continued[^3]',
        '',
        'Paragraph',
        '',
        '    - [^6]',
        '',
        '[^8]: Eight',
        '[^3]: Three'
    ].join('\n');
    const expected = input.replaceAll('[^8]', '[^1]').replaceAll('[^3]', '[^2]');
    assert.equal(tidyFootnotes(input), expected);
});
