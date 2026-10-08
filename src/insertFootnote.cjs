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

module.exports = { insertFootnote };
