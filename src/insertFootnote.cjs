'use strict';

const { hasFootnoteDefinition, nextNumberedFootnote } = require('./tidyFootnotes.cjs');

function insertFootnote(text, offset, label, options = {}) {
    const name = label || nextNumberedFootnote(text);
    const reference = `[^${name}]`;
    let result = text.slice(0, offset) + reference + text.slice(offset);
    if (options.reuseDefinition && hasFootnoteDefinition(text, name)) {
        return { text: result, cursorOffset: offset + reference.length, label: name };
    }

    const newline = /\r\n|\n|\r/.exec(text)?.[0] || '\n';
    const trailingNewlines = /(?:\r\n|\n|\r)+$/.exec(result)?.[0];
    if (!trailingNewlines) result += newline + newline;
    else if (trailingNewlines === newline) result += newline;
    result += `[^${name}]: `;
    return { text: result, cursorOffset: result.length, label: name };
}

// 이름 있는 각주의 라벨을 검증하고, 쓸 수 없는 이름이면 안내 문구를 돌려준다.
// markdown-it-footnote는 공백이 들어간 라벨을 각주로 인식하지 않는다.
// https://github.com/markdown-it/markdown-it-footnote/blob/3.0.3/index.js#L106
function validateFootnoteName(value) {
    const name = value.trim();

    if (!name) return 'Enter a footnote name.';
    if (/^[0-9]+$/.test(name)) return 'Use Insert Auto-Numbered Footnote for numeric labels.';
    if (/[\[\]\s]/.test(name)) return 'Footnote names cannot contain spaces, brackets, or line breaks.';

    return undefined;
}

module.exports = { insertFootnote, validateFootnoteName };
