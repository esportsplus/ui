type Command = 'all' | 'clear' | 'copy' | 'cut' | 'delete' | 'duplicate' | 'paste' | 'path' | 'redo' | 'relative' | 'toggle' | 'trash' | 'undo';


const EXTEND = new Set(['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp']);


// VS Code's explorer bindings, with Cmd standing in for Ctrl on macOS.
function command(event: KeyboardEvent): Command | null {
    let mod = event.ctrlKey || event.metaKey;

    // Option on macOS turns letters into symbols, so these go by the physical key.
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
        return mod ? 'relative' : 'path';
    }

    if (event.altKey) {
        return null;
    }

    if (event.key === 'Delete' || (event.metaKey && event.key === 'Backspace')) {
        return event.shiftKey ? 'delete' : 'trash';
    }

    if (event.key === 'Escape') {
        return 'clear';
    }

    if (mod && event.key.toLowerCase() === 'z') {
        return event.shiftKey ? 'redo' : 'undo';
    }

    if (!mod || event.shiftKey) {
        return null;
    }

    switch (event.key.toLowerCase()) {
        case ' ':
            return 'toggle';
        case 'a':
            return 'all';
        case 'c':
            return 'copy';
        case 'd':
            return 'duplicate';
        case 'v':
            return 'paste';
        case 'x':
            return 'cut';
        case 'y':
            return 'redo';
    }

    return null;
}

// Shift with these carries the selection along from the anchor.
function extending(event: KeyboardEvent) {
    return event.shiftKey && EXTEND.has(event.key);
}


export default command;
export { extending };
export type { Command };
