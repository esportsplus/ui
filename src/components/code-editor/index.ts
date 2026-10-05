import editor from './editor';
import markdown from './markdown';
import workspace from './workspace';
import '~/css-utilities/scrollbar/scss/index.scss';
import './scss/index.scss';


const codeEditor: typeof editor & {
    markdown: typeof markdown,
    workspace: typeof workspace
} = Object.assign(editor, { markdown, workspace });


export default codeEditor;
export { EditorDocument } from './document';
export { fileUri, languageIdFor, referenceRpcTransport } from './services';
export { EditorWorkspaceModel, isWorkspaceCodeEditor } from './workspace';
export type { CodeEditorAttributes } from './editor';
export type { Change, Edit, Selection, Snapshot, TransactionOptions, TransactionResult } from './document';
export type { BracketPair, FoldRange } from './folding';
export type { LayoutLine, Rect } from './layout';
export type { MarkdownController, MarkdownEditorAttributes, MarkdownOptions } from './markdown';
export type { Match, SearchOptions, SearchResult } from './search';
export type {
    CompletionItem,
    Diagnostic,
    Hover,
    LanguageServiceOptions,
    LanguageTransport,
    Notification,
    Position,
    Range,
    TextEdit
} from './services';
export type { Language, Token } from './syntax';
export type { Callbacks, Controller, Options } from './view';
export type {
    CodeEditorWorkspaceAttributes,
    CodeEditorWorkspaceController,
    WorkspaceConfirmation,
    WorkspaceDecision,
    WorkspaceEditorAttributes,
    WorkspaceEditorContext,
    WorkspaceEditorController,
    WorkspaceEntry,
    WorkspaceHost,
    WorkspacePreferences,
    WorkspaceTab,
    WorkspaceTarget
} from './workspace';
