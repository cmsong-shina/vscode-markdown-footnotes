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

// CommonMark는 탭을 4칸 단위의 탭 정지로 계산한다.
// https://spec.commonmark.org/0.31.2/#tabs
const TAB_WIDTH = 4;

// 내용 위치보다 4칸 이상 더 들여쓴 줄은 들여쓴 코드 블록이다.
// https://spec.commonmark.org/0.31.2/#indented-code-blocks
const CODE_INDENT = 4;

const LIST_ITEM = /^([ \t]*)([-+*]|\d+[.)])[ \t]+/;
const DEFINITION = /^ {0,3}\[\^([^\]\r\n]+)\]:/;

// 백틱 펜스의 정보 문자열에는 백틱이 올 수 없다.
// 이 조건이 없으면 줄 맨 앞의 인라인 코드(```x```)를 펜스로 오인한다.
// https://spec.commonmark.org/0.31.2/#fenced-code-blocks
const OPENING_FENCE = /^([ \t]*)(`{3,}(?=[^`]*$)|~{3,})/;

// 제목과 구분선(또는 Setext 밑줄)은 한 줄로 끝나서 다음 줄로 문단이 이어지지 않는다.
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const RULE_OR_UNDERLINE = /^ {0,3}(?:=+|-+|([-*_])(?:[ \t]*\1){2,})[ \t]*$/;

function columnWidth(text) {
    let width = 0;
    for (const character of text) {
        if (character === '\t') width += TAB_WIDTH - (width % TAB_WIDTH);
        else width++;
    }
    return width;
}

function indentationWidth(text) {
    return columnWidth(/^[ \t]*/.exec(text)[0]);
}

// 목록 항목 줄에서 마커의 들여쓰기와 내용이 시작하는 열을 구한다.
// 마커 뒤 공백이 4칸을 넘으면 내용은 마커 한 칸 뒤에서 시작하고 나머지는 들여쓴 코드가 된다.
// https://spec.commonmark.org/0.31.2/#list-items
function parseListItem(content) {
    const match = LIST_ITEM.exec(content);
    if (!match) return undefined;

    const [marked, leading, marker] = match;
    const markerEnd = columnWidth(leading + marker);
    const paddedEnd = columnWidth(marked);
    const padding = paddedEnd - markerEnd;

    return {
        indent: columnWidth(leading),
        contentIndent: padding > CODE_INDENT ? markerEnd + 1 : paddedEnd
    };
}

function isSingleLineBlock(content) {
    return ATX_HEADING.test(content) || RULE_OR_UNDERLINE.test(content);
}

// 문단을 끊고 새 블록을 시작하는 줄인지 판별한다.
function interruptsParagraph(content) {
    if (!content.trim()) return true;
    if (isSingleLineBlock(content)) return true;

    return OPENING_FENCE.test(content) || LIST_ITEM.test(content) || DEFINITION.test(content);
}

// lineIndex 줄에서 시작한 인라인 구문이 이어질 수 있는 범위의 끝(마지막 줄의 다음 줄)을 구한다.
function inlineBlockEnd(lines, lineIndex) {
    let end = lineIndex + 1;
    if (isSingleLineBlock(lines[lineIndex].content)) return end;

    while (end < lines.length && !interruptsParagraph(lines[end].content)) end++;
    return end;
}

// (lineIndex, column) 뒤로 같은 문단 안에 닫는 표식이 있는지 확인한다.
// 닫는 짝이 없는 여는 표식은 구문을 열지 못하고 글자 그대로 남는다.
// 이를 확인하지 않으면 짝 없는 백틱 하나가 문서 끝까지 코드로 취급된다.
// https://spec.commonmark.org/0.31.2/#code-spans
function closesInParagraph(lines, lineIndex, column, hasCloser) {
    if (hasCloser(lines[lineIndex].content.slice(column))) return true;

    const end = inlineBlockEnd(lines, lineIndex);
    for (let next = lineIndex + 1; next < end; next++) {
        if (hasCloser(lines[next].content)) return true;
    }
    return false;
}

function hasBacktickRun(content, length) {
    const runs = content.match(/`+/g) || [];
    return runs.some(run => run.length === length);
}

function collectFootnotes(text) {
    const lines = getLines(text);
    const mainReferences = [];
    const definitionReferences = [];
    const definitions = [];
    const allDefinitions = [];
    let fence;
    let codeDelimiter = 0;
    let comment; // 열려 있는 HTML 주석의 종류: 'block' | 'inline' | undefined
    let inDefinition = false;
    let paragraphOpen = false;
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
        // 블록 주석에 속한 줄은 HTML 블록이라 다음 줄로 문단이 이어지지 않는다.
        let htmlBlockLine = comment === 'block';

        if (!codeDelimiter && !comment) {
            const openingFence = OPENING_FENCE.exec(content);
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
                paragraphOpen = false;
                continue;
            }
        }

        const listItem = parseListItem(content);
        let inList = false;
        if (listItem) {
            while (listStack.length && listStack[listStack.length - 1].indent >= listItem.indent) listStack.pop();
            if (listItem.indent < CODE_INDENT || listStack.length || inDefinition) {
                listStack.push(listItem);
                inList = true;
            }
        } else if (content.trim() && !/^[ \t]/.test(content)) {
            listStack.length = 0;
        }
        const indent = indentationWidth(content);
        const listContinuation = listStack.some(item => indent >= item.contentIndent && indent < item.contentIndent + CODE_INDENT);

        const definition = !codeDelimiter && !comment && DEFINITION.exec(content);
        if (definition) {
            allDefinitions.push(definition[1]);
            if (/^\d+$/.test(definition[1])) {
                definitions.push({ label: definition[1], offset: line.offset + definition[0].indexOf('[^') + 2, lineIndex });
            }
            inDefinition = true;
        } else if (content.trim() && !/^ {4}|^\t/.test(content)) {
            inDefinition = false;
        }

        // 들여쓴 코드 블록은 문단을 끊지 못하므로, 문단이 열려 있으면 깊이 들여쓴 줄도 본문이다.
        // 주석 안의 줄은 닫는 표식을 찾아야 하므로 건너뛰지 않는다.
        // https://spec.commonmark.org/0.31.2/#indented-code-blocks
        const codeIndent = inDefinition ? CODE_INDENT * 2 : CODE_INDENT;
        const isText = paragraphOpen || comment || inList || listContinuation;

        if (!isText && indent >= codeIndent) {
            paragraphOpen = false;
            continue;
        }

        for (let i = 0; i < content.length;) {
            if (comment) {
                const end = content.indexOf('-->', i);
                if (end < 0) break;
                comment = undefined;
                i = end + 3;
                continue;
            }
            if (!codeDelimiter && content.startsWith('<!--', i)) {
                // 줄 맨 앞의 주석은 HTML 블록이라 닫힐 때까지(닫히지 않으면 문서 끝까지) 이어진다.
                // 문단 중간의 주석은 같은 문단 안에서 닫혀야 주석이다.
                // https://spec.commonmark.org/0.31.2/#html-blocks
                const startsLine = !content.slice(0, i).trim();
                const closes = rest => rest.includes('-->');

                if (startsLine) {
                    comment = 'block';
                    htmlBlockLine = true;
                } else if (closesInParagraph(lines, lineIndex, i + 4, closes)) {
                    comment = 'inline';
                }
                i += 4;
                continue;
            }
            if (content[i] === '`') {
                let end = i + 1;
                while (content[end] === '`') end++;
                const length = end - i;

                if (codeDelimiter === length) {
                    codeDelimiter = 0;
                } else if (!codeDelimiter) {
                    const closes = rest => hasBacktickRun(rest, length);
                    if (closesInParagraph(lines, lineIndex, end, closes)) codeDelimiter = length;
                }
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

        const isBlank = !content.trim();
        paragraphOpen = !isBlank && !htmlBlockLine && !isSingleLineBlock(content);
    }
    return { lines, mainReferences, definitionReferences, definitions, allDefinitions };
}

// 가장 큰 번호의 다음 번호를 돌려준다.
// 문서 순서상 마지막 번호를 기준으로 하면 정의 뒤에 본문이 이어지거나
// 정의가 번호순이 아닐 때 이미 쓰인 번호와 겹친다.
function nextNumberedFootnote(text) {
    const { mainReferences, definitionReferences, definitions } = collectFootnotes(text);
    const entries = [...mainReferences, ...definitionReferences, ...definitions];

    // 라벨은 자릿수 제한이 없으므로 BigInt로 비교한다.
    let largest = 0n;
    for (const entry of entries) {
        const number = BigInt(entry.label);
        if (number > largest) largest = number;
    }
    return String(largest + 1n);
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
