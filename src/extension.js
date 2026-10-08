'use strict'

const { tidyFootnotes } = require('./tidyFootnotes.cjs');
const { insertFootnote } = require('./insertFootnote.cjs');

async function insertAtCursor(editor, vscode, label, reuseDefinition) {
    if (editor.document.languageId !== 'markdown') return;
    const original = editor.document.getText();
    const offset = editor.document.offsetAt(editor.selection.active);
    const inserted = insertFootnote(original, offset, label, { reuseDefinition });
    const changed = await editor.edit(edit => {
        edit.replace(new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(original.length)), inserted.text);
    });
    if (changed) {
        const position = editor.document.positionAt(inserted.cursorOffset);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
    }
}

export function activate(context) {
    const vscode = require('vscode');
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('markdown-footnotes.tidyFootnotes', editor => {
        if (editor.document.languageId !== 'markdown') return;
        const original = editor.document.getText();
        const tidied = tidyFootnotes(original);
        if (tidied === original) return;
        return editor.edit(edit => {
            edit.replace(new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(original.length)), tidied);
        });
    }));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('markdown-footnotes.insertNamedFootnote', async editor => {
        if (editor.document.languageId !== 'markdown') return;
        const label = await vscode.window.showInputBox({
            prompt: 'Footnote name',
            placeHolder: 'source',
            validateInput(value) {
                const name = value.trim();
                if (!name) return 'Enter a footnote name.';
                if (/^[0-9]+$/.test(name)) return 'Use Insert Auto-Numbered Footnote for numeric labels.';
                if (/[\[\]\r\n]/.test(name)) return 'Footnote names cannot contain brackets or line breaks.';
                return undefined;
            }
        });
        if (label !== undefined) return insertAtCursor(editor, vscode, label.trim(), true);
    }));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('markdown-footnotes.insertAutoNumberedFootnote', editor => {
        return insertAtCursor(editor, vscode);
    }));
    return {
        extendMarkdownIt(md) {
            return md.use(require('markdown-it-footnote'));
        }
    };
}
