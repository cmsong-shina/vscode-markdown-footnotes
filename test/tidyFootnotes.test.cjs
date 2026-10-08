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
