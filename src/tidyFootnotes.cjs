'use strict';

function getLines(text) {
    const lines = [];
    const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
    let match;
    while ((match = pattern.exec(text)) && match[0]) {
        lines.push({ content: match[1], raw: match[0], offset: match.index });
    }
    return lines;
}

function indentationWidth(text) {
    let width = 0;
    for (const character of text) {
        if (character === ' ') width++;
        else if (character === '\t') width += 4 - (width % 4);
        else break;
    }
    return width;
}

function collectFootnotes(text) {
    const lines = getLines(text);
    const mainReferences = [];
    const definitionReferences = [];
    const definitions = [];
    const allDefinitions = [];
    let fence;
    let codeDelimiter = 0;
    let inComment = false;
    let inDefinition = false;
    const listStack = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const content = line.content;
        if (fence) {
            const closingFence = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(content);
            const indent = closingFence && indentationWidth(closingFence[1]);
            if (closingFence && closingFence[2][0] === fence.character && closingFence[2].length >= fence.length && indent >= fence.minIndent && indent <= fence.maxIndent) {
                fence = undefined;
            }
            continue;
        }
        if (!codeDelimiter && !inComment) {
            const openingFence = /^([ \t]*)(`{3,}|~{3,})/.exec(content);
            const indent = openingFence && indentationWidth(openingFence[1]);
            let listParent;
            for (let i = listStack.length - 1; openingFence && i >= 0; i--) {
                if (indent >= listStack[i].contentIndent && indent <= listStack[i].contentIndent + 3) {
                    listParent = listStack[i];
                    break;
                }
            }
            const baseIndent = indent <= 3 ? 0 : inDefinition && indent <= 7 ? 4 : listParent && listParent.contentIndent;
            if (openingFence && baseIndent !== undefined) {
                fence = { character: openingFence[2][0], length: openingFence[2].length, minIndent: baseIndent, maxIndent: baseIndent + 3 };
                if (baseIndent === 0) inDefinition = false;
                continue;
            }
        }

        const listItem = /^([ \t]*)(?:[-+*]|\d+[.)])[ \t]+/.exec(content);
        let inList = false;
        if (listItem) {
            const indent = indentationWidth(listItem[1]);
            while (listStack.length && listStack[listStack.length - 1].indent >= indent) listStack.pop();
            if (indent < 4 || listStack.length || inDefinition) {
                listStack.push({ indent, contentIndent: indentationWidth(listItem[0]) });
                inList = true;
            }
        } else if (content.trim() && !/^[ \t]/.test(content)) {
            listStack.length = 0;
        }
        const indent = indentationWidth(content);
        const listContinuation = listStack.some(item => indent >= item.contentIndent && indent < item.contentIndent + 4);

        const definition = !codeDelimiter && !inComment && /^ {0,3}\[\^([^\]\r\n]+)\]:/.exec(content);
        if (definition) {
            allDefinitions.push(definition[1]);
            if (/^\d+$/.test(definition[1])) {
                definitions.push({ label: definition[1], offset: line.offset + definition[0].indexOf('[^') + 2, lineIndex });
            }
            inDefinition = true;
        } else if (content.trim() && !/^ {4}|^\t/.test(content)) {
            inDefinition = false;
        }
        if (!inList && !listContinuation && ((!inDefinition && indent >= 4) || (inDefinition && indent >= 8))) {
            continue;
        }

        for (let i = 0; i < content.length;) {
            if (inComment) {
                const end = content.indexOf('-->', i);
                if (end < 0) break;
                inComment = false;
                i = end + 3;
                continue;
            }
            if (!codeDelimiter && content.startsWith('<!--', i)) {
                inComment = true;
                i += 4;
                continue;
            }
            if (content[i] === '`') {
                let end = i + 1;
                while (content[end] === '`') end++;
                const length = end - i;
                if (!codeDelimiter) codeDelimiter = length;
                else if (codeDelimiter === length) codeDelimiter = 0;
                i = end;
                continue;
            }
            if (codeDelimiter) {
                i++;
                continue;
            }
            if (content[i] === '\\') {
                i += 2;
                continue;
            }
            if (content.startsWith('[^', i)) {
                const reference = /^\[\^(\d+)\]/.exec(content.slice(i));
                if (reference) {
                    if (!definition || i !== definition[0].indexOf('[^')) {
                        const entry = { label: reference[1], offset: line.offset + i + 2 };
                        (inDefinition ? definitionReferences : mainReferences).push(entry);
                    }
                    i += reference[0].length;
                    continue;
                }
            }
            i++;
        }
    }
    return { lines, mainReferences, definitionReferences, definitions, allDefinitions };
}

function nextNumberedFootnote(text) {
    const { mainReferences, definitionReferences, definitions } = collectFootnotes(text);
    const entries = [...mainReferences, ...definitionReferences, ...definitions].sort((a, b) => a.offset - b.offset);
    return entries.length ? String(BigInt(entries[entries.length - 1].label) + 1n) : '1';
}

function hasFootnoteDefinition(text, label) {
    return collectFootnotes(text).allDefinitions.includes(label);
}

function sortDefinitionGroups(text) {
    const { lines, definitions } = collectFootnotes(text);
    const byLine = new Map(definitions.map(definition => [definition.lineIndex, definition]));
    const groups = [];
    for (let i = 0; i < lines.length;) {
        if (!byLine.has(i)) {
            i++;
            continue;
        }
        const blocks = [];
        let end = i;
        do {
            const start = end;
            end++;
            while (end < lines.length && !byLine.has(end) && (!lines[end].content.trim() || /^ {4}|^\t/.test(lines[end].content))) {
                end++;
            }
            let contentEnd = end;
            while (contentEnd > start + 1 && !lines[contentEnd - 1].content.trim()) contentEnd--;
            const rawContent = lines.slice(start, contentEnd).map(line => line.raw).join('');
            const ending = /(\r\n|\n|\r)$/.exec(rawContent);
            blocks.push({
                label: Number(byLine.get(start).label),
                text: ending ? rawContent.slice(0, -ending[0].length) : rawContent,
                separator: (ending ? ending[0] : '') + lines.slice(contentEnd, end).map(line => line.raw).join('')
            });
        } while (byLine.has(end));
        if (blocks.length > 1) {
            const sortedBlocks = [...blocks].sort((a, b) => a.label - b.label);
            const sorted = sortedBlocks.map((block, index) => block.text + blocks[index].separator).join('');
            groups.push({ start: lines[i].offset, end: end < lines.length ? lines[end].offset : text.length, text: sorted });
        }
        i = end;
    }
    for (const group of groups.reverse()) {
        text = text.slice(0, group.start) + group.text + text.slice(group.end);
    }
    return text;
}

function tidyFootnotes(text) {
    const { mainReferences, definitionReferences, definitions } = collectFootnotes(text);
    const numbers = new Map();
    for (const entry of [...mainReferences, ...definitionReferences, ...definitions]) {
        if (!numbers.has(entry.label)) numbers.set(entry.label, String(numbers.size + 1));
    }
    const edits = [...mainReferences, ...definitionReferences, ...definitions].sort((a, b) => b.offset - a.offset);
    for (const edit of edits) {
        const replacement = numbers.get(edit.label);
        text = text.slice(0, edit.offset) + replacement + text.slice(edit.offset + edit.label.length);
    }
    return sortDefinitionGroups(text);
}

module.exports = { tidyFootnotes, nextNumberedFootnote, hasFootnoteDefinition };
