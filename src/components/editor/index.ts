import code from './code';
import diffs from './diffs';
import markdown from './markdown';
import tree from './tree';
import workspace from './workspace';


const editor: {
    code: typeof code,
    diffs: typeof diffs,
    markdown: typeof markdown,
    tree: typeof tree,
    workspace: typeof workspace
} = { code, diffs, markdown, tree, workspace };


export default editor;
export * from './code';
export { acceptChange, conflictMarkers, diff3, diffTexts, hunks, resolveMarker, revertChange, words } from './diffs';
export {
    createFileTreeIconResolver,
    FileTreeDecorations,
    FileTreeEditor,
    FileTreeElements,
    FileTreeHistory,
    fileTreeIcon,
    resolveFileTreeIcon
} from './tree';
export { EditorWorkspaceModel, isWorkspaceCodeEditor } from './workspace';
export type {
    ConflictMarker,
    DiffChange,
    DiffsAttributes,
    DiffsController,
    DiffsState,
    Hunk,
    MergeAttributes,
    MergeChoice,
    MergeRegion,
    MergeResult
} from './diffs';
export type { MarkdownController, MarkdownEditorAttributes, MarkdownOptions } from './markdown';
export type * from './tree';
export type {
    CodeEditorWorkspaceAttributes,
    CodeEditorWorkspaceController,
    WorkspaceAction,
    WorkspaceConfirmation,
    WorkspaceDecision,
    WorkspaceEditor,
    WorkspaceEditorAttributes,
    WorkspaceEditorContext,
    WorkspaceEditorController,
    WorkspaceEntry,
    WorkspaceHost,
    WorkspacePreferences,
    WorkspaceTab,
    WorkspaceTarget
} from './workspace';
