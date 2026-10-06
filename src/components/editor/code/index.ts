import editor from './editor';
import '~/css-utilities/scrollbar/scss/index.scss';
import './scss/index.scss';


export default editor;
export { EditorDocument } from './document';
export { COMMANDS as commands } from './keymap';
export { fileUri, languageIdFor, referenceRpcTransport } from './services';
export type { CodeEditorAttributes } from './editor';
export type { Conflict, Resolution as ConflictResolution } from './conflicts';
export type { Change, Edit, Selection, Snapshot, TransactionOptions, TransactionResult } from './document';
export type { BracketPair, FoldRange } from './folding';
export type { Command, CommandInfo } from './keymap';
export type { LayoutLine, Rect } from './layout';
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
export type { Callbacks, CodeController as Controller, Options, State as CodeEditorState } from './view';
