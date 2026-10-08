
# Vscode Markdown Footnotes

This repo is a fork of [vscode-markdown-footnotes](https://github.com/mjbvz/vscode-markdown-footnotes) with additional features:

- Inserting automatically numbered or named footnotes
- Reordering numbered footnotes

Adds \[^1] footnote syntax support to VS Code's built-in Markdown preview

![](https://github.com/mjbvz/vscode-markdown-footnotes/raw/master/docs/example.png)

# Features 
- Adds support for \[^1] syntax to VS Code's built-in markdown preview
- Run **Markdown: Tidy Footnotes** from the Command Palette to number numeric footnotes in the order their references appear. The command updates matching definitions and sorts adjacent definition blocks. Named footnotes stay as they are.
- Run **Markdown: Insert Named Footnote** to enter a name and insert its reference at the cursor. If that name already has a definition, the command reuses it.
- Run **Markdown: Insert Auto-Numbered Footnote** to insert a numeric reference. Its number is one greater than the last numbered footnote in the document.

# Use locally without publishing

From this directory, build an installable VSIX and install it in VS Code:

```sh
npx.cmd --yes @vscode/vsce package --out markdown-footnotes-local.vsix
code --install-extension markdown-footnotes-local.vsix --force
```
