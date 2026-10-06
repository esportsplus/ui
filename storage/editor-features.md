# Editor and file tree features we don't have yet

Features from other code editors that `code-editor`, `code-editor/workspace` and `file-tree` don't offer yet.

Editors surveyed:

- VS Code and Monaco
- JetBrains IDEs (WebStorm, IntelliJ, Fleet)
- Zed
- Sublime Text
- Nova
- Helix
- Neovim file explorers (neo-tree, nvim-tree, oil.nvim)
- Emacs
- CodeMirror 6

Features we already ship are left out. On the editor side these include:

- multiple cursors, Alt+click and box selection, occurrence selection, and selection undo;
- line move, copy and delete, comments, indent and reindent;
- folding, bracket jump and pair selection, and auto-close and surround;
- find and replace with regex, case and whole word;
- minimap, wrap and visible whitespace;
- completion, hover and diagnostics over a language server;
- tabs, quick open, breadcrumbs and save in the workspace.

On the file tree side these include:

- compact folders, sticky folders, filtering, type-to-find and typeahead;
- sort modes, git and diagnostic decorations, and colour scopes;
- multiple roots, lazy loading and preview opening;
- drag and drop with Alt to copy and folders that open on hover;
- cut, copy, paste and duplicate, rename and create in place, and trash or permanent delete;
- undo and redo, shortcuts, and screen-reader labels.

## File tree

| Feature | What it does | Seen in |
| --- | --- | --- |
| File nesting | Groups related files under a parent: `index.ts` → `index.test.ts`, `index.d.ts`; `package.json` → lockfiles. Driven by configurable patterns. | VS Code, JetBrains |
| Compare selected | Marks two files and opens a diff of them, or compares one with the clipboard or its saved version. | VS Code, Zed |
| Drop from the OS | Accepts files and folders dragged in from the desktop or file manager and copies them into the target folder. | VS Code, Zed, JetBrains |
| Drag out to the OS | Dragging a row out of the tree hands the file to the desktop or another app. | VS Code (desktop), Nova |
| Next and previous change or problem | Moves the cursor to the next or previous entry with a git change or a diagnostic. | Zed |
| Open editors list | A section listing the open tabs, with close, save and reorder actions and dirty markers. | VS Code |
| Outline view | A panel listing the active file's symbols, with follow-cursor and sorting by position, name or kind. | VS Code, JetBrains (Structure), Zed |
| Timeline and local history | Each file's saves, git commits and file operations over time, with restore and compare against any entry. | VS Code, JetBrains |
| Favorites and bookmarks | Pins files or folders to a persistent section at the top so they're quick to reach. | JetBrains, Nova |
| Scratch files | Temporary files outside the project tree, kept across sessions, each with its own language. | JetBrains |
| Find in folder | Starts a project-wide text search scoped to the selected folder. | VS Code, Zed, JetBrains |
| Edit the tree as text | Opens a folder as an editable list of names: renaming lines renames files, deleting lines deletes them, all applied on save. | oil.nvim, Emacs `wdired` |
| Bulk rename | Renames many selected files at once with a pattern or a find and replace, with a preview first. | JetBrains, VS Code extensions, Nova |
| Image and media preview | Shows a thumbnail on hover, or an image carousel for media files, without opening an editor. | VS Code, Nova |
| Alternative sources | The same tree shows other data: open buffers, a git status view, remote file systems, diagnostics. | neo-tree |
| Folder-level stats | Totals for a folder, such as file count and total size, in a tooltip or column. | Nova, JetBrains |

## Editing

| Feature | What it does | Seen in |
| --- | --- | --- |
| Expand and shrink selection | Grows the selection to the enclosing syntax node (word → string → argument → call → statement → block) and shrinks it back. | VS Code, JetBrains, Zed, Helix |
| Text objects | Commands that act on a function, class, argument, comment or test by its structure: select, delete, change, jump. | Helix, Neovim |
| Join lines | Joins the next line onto the current one with the whitespace normalised, at every caret. | JetBrains, Sublime, VS Code |
| Sort, reverse and dedupe lines | Sorts, reverses or deduplicates the selected lines, optionally ignoring case. | JetBrains, Sublime, VS Code |
| Case transforms | Upper, lower, title, camel, snake and kebab case for the selection. | VS Code, JetBrains, Sublime |
| Overtype mode | Insert toggles typing over existing characters, with its own caret style. | VS Code |
| Smart paste | Re-indents pasted code to the target's indentation and escapes it when pasted into a string. | JetBrains, VS Code |
| Clipboard history | Paste any of the last N copied snippets from a picker. | JetBrains, Sublime |
| Paste as plain text | Paste that skips any reformatting or escaping. | JetBrains |
| User snippets | Named templates with tab stops, placeholders, choices and variables (`$TM_FILENAME`, `$CLIPBOARD`), triggered by prefix. | VS Code, JetBrains (live templates), Sublime |
| Postfix completion | Typing `.if`, `.not` or `.log` after an expression wraps it in that construct. | JetBrains |
| Complete statement | Adds the missing closing brackets and semicolon and moves to the next line. | JetBrains |
| Unwrap and remove | Removes an enclosing `if`, `try` or block and keeps its body. | JetBrains |
| Linked editing | Editing an HTML or JSX opening tag renames the closing tag too. | VS Code, JetBrains |
| Emmet | Expands abbreviations such as `div.card>ul>li*3` into markup. | VS Code, JetBrains, Sublime, Nova |
| Increment and decrement numbers | Bumps the number under the caret up or down, at every caret. | Helix, Neovim, Sublime |
| Duplicate selection | Duplicates the selection itself rather than whole lines. | JetBrains, Sublime |
| Trim trailing whitespace and final newline | Removes trailing whitespace and ensures a single final newline, on save or by command. | VS Code, Sublime, JetBrains |
| Convert indentation | Converts the file between tabs and spaces, and changes the indent width. | VS Code, Sublime |
| Toggle a line comment per line | A comment toggle that works on each line on its own when the selected lines are mixed. | Sublime, Zed |
| Format document and selection | Runs a formatter on the whole file, the selection, on type, on paste or on save. | VS Code, JetBrains, Zed |

## Selection and carets

| Feature | What it does | Seen in |
| --- | --- | --- |
| Skip occurrence | While adding next-occurrence carets, skips the current match and moves on. | VS Code, Sublime, Zed |
| Split selection into lines | Turns a multi-line selection into one caret at the end of each line. | VS Code, Sublime |
| Select within a selection | Keeps only the regex matches inside the current selections, each as its own selection. | Helix, Kakoune |
| Align carets | Inserts padding so every caret lines up in one column. | Sublime (packages), Helix |
| Sub-word movement | Moves and deletes by camelCase and snake_case parts. | VS Code, JetBrains, Sublime |
| Caret history | Jumps back and forward through earlier caret positions, across files. | VS Code, JetBrains, Zed |

## Find and replace

| Feature | What it does | Seen in |
| --- | --- | --- |
| Find in selection | Limits find and replace to the selected range. | VS Code, Sublime, JetBrains |
| Preserve case | Replacing `foo` with `bar` turns `Foo` into `Bar` and `FOO` into `BAR`. | VS Code |
| Regex case modifiers | `\u`, `\l`, `\U` and `\L` in the replacement change the case of the captured groups. | VS Code |
| Find history | Earlier queries and replacements one keypress away, kept across sessions. | VS Code, JetBrains |
| Seed from selection | Opening find fills in the selected text or the word at the caret. | VS Code, Sublime |
| Search across files | Searches the whole workspace with include and exclude globs, then replaces with a preview. | VS Code, Zed, JetBrains, Sublime |
| Search editor and multibuffer | Shows project results as one editable document; edits go back to the source files. | VS Code (Search Editor), Zed (multibuffer) |
| Matches in the scrollbar | Marks every match, the selection and diagnostics along the scrollbar track. | VS Code, JetBrains, Sublime |

## Navigation

| Feature | What it does | Seen in |
| --- | --- | --- |
| Go to symbol | A picker of the file's or the workspace's symbols, filtered fuzzily, with `@` and `#` prefixes. | VS Code, Sublime, Zed, JetBrains |
| Combined quick open | One input for files, `:line`, `@symbol` and `>commands`. | VS Code, Sublime |
| Recent files | A list of the most recently used files, with switching tabs in that order (Ctrl+Tab). | VS Code, JetBrains, Zed |
| Go to definition, type and implementation | Ctrl+click or F12 opens a symbol's definition, its type, or its implementations. | VS Code, Zed, JetBrains |
| Peek | An inline panel with the definition or references, editable in place. | VS Code |
| Find references | Lists every use of a symbol, grouped by file. | VS Code, Zed, JetBrains |
| Breadcrumb symbols | Breadcrumbs go past the file into the symbol path, and each crumb opens a picker of its siblings. | VS Code, Zed |
| Bookmarks | Toggleable line markers with a list and next and previous jumps. | JetBrains, Sublime, VS Code extensions |
| Go to last edit | Jumps to where the document was last changed. | VS Code, JetBrains |
| Go to next problem | Moves to the next diagnostic and shows its message inline. | VS Code, Zed |
| Structural jumps | Next and previous function, class, parameter or test. | Helix, Neovim |

## Language intelligence

These need the transport we already have to carry more language-server methods.

| Feature | What it does | Seen in |
| --- | --- | --- |
| Signature help | Shows the call's parameters and highlights the current one while typing arguments. | VS Code, JetBrains, Zed |
| Rename symbol | Renames a symbol everywhere, with a preview of the edits. | VS Code, Zed, JetBrains |
| Code actions and quick fixes | A light bulb with fixes and refactorings for the caret or the diagnostic. | VS Code, Zed, JetBrains |
| Inlay hints | Inline parameter names and inferred types, revealed with a modifier key. | VS Code, JetBrains, Zed |
| Code lens | Clickable notes above declarations, such as reference counts or "run test". | VS Code, JetBrains (Code Vision) |
| Semantic highlighting | Colours from the language server, so parameters, constants and types are told apart. | VS Code, Zed |
| Document highlight | Highlights other uses of the symbol under the caret, separating reads from writes. | VS Code, JetBrains |
| Server folding ranges | Folding ranges from the server for languages without a bracket structure. | VS Code |
| Call and type hierarchy | Trees of a function's callers and callees, or of a type's supertypes and subtypes. | VS Code, JetBrains |
| Inline completions | Grey ghost text suggesting the rest of a line or block, accepted with Tab. | VS Code, Monaco, Zed, JetBrains |
| Next edit suggestions | Predicts the next edit somewhere else in the file and offers to apply it. | VS Code, Cursor, Zed |

## Display

| Feature | What it does | Seen in |
| --- | --- | --- |
| Indent guides | Vertical lines at each indent level, with the active scope's guide emphasised. | VS Code, Sublime, JetBrains, Zed |
| Bracket pair colours | Matching brackets coloured by depth, with guides linking each pair. | VS Code, JetBrains, Zed |
| Sticky scroll | The enclosing function, class and block headers stay pinned at the top while scrolling. | VS Code, JetBrains, Zed |
| Vertical rulers | Lines at chosen columns, such as 80 and 120. | VS Code, Sublime, JetBrains |
| Git gutter | Added, modified and deleted markers beside line numbers, with an inline diff on click and revert per change. | VS Code, Zed, JetBrains, Sublime |
| Inline blame | The last commit's author and date at the end of the caret's line. | Zed, VS Code (GitLens), JetBrains |
| Colour swatches | Swatches and a picker beside CSS colour values. | VS Code, JetBrains, Zed |
| Clickable links | URLs and file paths become links, opened with Ctrl/Cmd+click. | VS Code, JetBrains |
| Unicode warnings | Flags invisible, confusable and bidirectional characters. | VS Code |
| Font ligatures and zoom | Opt-in ligatures, plus zooming the editor font in and out. | VS Code, JetBrains, Zed |
| Smooth caret | Animated caret movement and blink styles. | VS Code |

## Folding

| Feature | What it does | Seen in |
| --- | --- | --- |
| Fold to a level | Folds every region at nesting level N. | VS Code |
| Fold recursively | Folds or unfolds a region and everything inside it. | VS Code, JetBrains |
| Fold comments and imports | Folds every block comment, or the import section, in one command. | VS Code, JetBrains |
| Region markers | `// #region` and `// #endregion` comments define named foldable regions. | VS Code, JetBrains |
| Fold the selection | Folds any selected range by hand, independent of the syntax. | VS Code, JetBrains |

## Files, saving and documents

| Feature | What it does | Seen in |
| --- | --- | --- |
| Auto save | Saves after a delay, on focus change or on window change. | VS Code, JetBrains, Zed |
| Hot exit | Unsaved drafts survive closing and reloading, and come back on reopen. | VS Code, Sublime, Zed |
| Conflict on save | When the file changed on disk, offers compare, overwrite or reload instead of silently overwriting. | VS Code, JetBrains |
| Line endings | Shows and converts LF and CRLF per file. | VS Code, Sublime, JetBrains |
| Encoding | Shows, reopens with and saves with a chosen encoding. | VS Code, Sublime, JetBrains |
| Indent detection | Detects tabs or spaces and the indent width from the file's contents. | VS Code, Sublime |
| EditorConfig | Applies `.editorconfig` indentation, line-ending and charset rules. | VS Code (extension), JetBrains, Zed, Sublime |
| Large file mode | Opens very large files with expensive features such as highlighting and folding turned off. | VS Code, JetBrains |
| Read-only toggle | Locks a file against edits from the tab or status bar. | JetBrains, VS Code |

## Diff and merge

| Feature | What it does | Seen in |
| --- | --- | --- |
| Diff editor | Side-by-side or inline diff with character-level highlights, next and previous change, and accept or revert per change. | VS Code, Monaco, JetBrains, CodeMirror merge |
| Three-way merge editor | Resolves conflicts with incoming, current and result panes. | VS Code, JetBrains |
| Conflict markers | Inline "accept current / incoming / both" actions on `<<<<<<<` blocks. | VS Code, Zed |

## Workspace and layout

| Feature | What it does | Seen in |
| --- | --- | --- |
| Split editors and groups | Two or more editors side by side or stacked, with tabs draggable between them. | VS Code, Zed, JetBrains, Sublime |
| Preview tabs | A single-click open reuses one italic tab until it's edited or pinned. | VS Code, Zed |
| Pinned tabs | Pinned tabs stay first, shrink to an icon, and survive "close others". | VS Code, JetBrains |
| Tab context actions | Close others, close to the right, close saved, copy path and reveal in the tree. | VS Code, JetBrains, Zed |
| Reopen closed tab | Reopens the most recently closed tab (Ctrl/Cmd+Shift+T). | VS Code, JetBrains, Zed |
| Zen and centered layout | A distraction-free full-width mode, and a centred column of text. | VS Code, Sublime |
| Command palette for editor commands | Every editor and workspace command, searchable, with its shortcut shown. | VS Code, Sublime, Zed, JetBrains |
| Keybinding editor | Lets users view and remap shortcuts and see conflicts. | VS Code, JetBrains, Zed |
| Status bar items | Caret, selection count, language, indentation, line ending and encoding, each clickable to change. | VS Code, Sublime, JetBrains |
| Persisted session | Restores open tabs, layout, scroll and folds across reloads. | VS Code, Sublime, Zed |

## Collaboration and input

| Feature | What it does | Seen in |
| --- | --- | --- |
| Real-time collaboration | Shared editing with remote carets, selections and following. | Zed, VS Code Live Share, JetBrains Code With Me, CodeMirror collab |
| Vim and modal keymaps | A Vim or Helix-style keymap, as an option next to the Emacs-style bindings. | Zed, VS Code, JetBrains, Sublime |
| Inline AI assistant | Prompt-driven edits of the selection, shown as a diff to accept or reject. | Zed, Cursor, VS Code, JetBrains |

## Sources

- [Zed project panel](https://zed.dev/docs/project-panel)
- [Zed features](https://zed.dev/features)
- [VS Code user interface](https://code.visualstudio.com/docs/getstarted/userinterface)
- [VS Code basic editing](https://code.visualstudio.com/docs/editing/codebasics)
- [VS Code editor features overview](https://www.mintlify.com/Microsoft/vscode/features/editor)
- [WebStorm project tool window](https://jetbrains.com/help/webstorm/project-tool-window.html)
- [WebStorm source code editing](https://www.jetbrains.com/help/webstorm/working-with-source-code.html)
- [Sublime Text](https://wikipedia.com/wiki/SublimeText)
- [Helix text objects](https://docs.helix-editor.com/textobjects.html)
- [Neovim file explorers](https://pawelgrzybek.com/neovim-file-explorers/)
- [Nova sidebar](https://help.panic.com/nova/sidebar)
- [Nova file browser](https://library.panic.com/nova/file-browser)
- [CodeMirror extensions](https://codemirror.net/docs/extensions)
- [Monaco changelog](https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/CHANGELOG.md)
