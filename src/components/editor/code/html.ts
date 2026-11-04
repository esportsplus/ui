// Runs one line may split into before it renders as plain text.
const BUDGET = 3000;

const ESCAPE = /[&<>"]/;

const ESCAPES: Record<string, string> = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };

// Longer lines skip highlighting.
const LONG = 10000;


function escape(text: string) {
    return ESCAPE.test(text) ? text.replace(/[&<>"]/g, (character) => ESCAPES[character]) : text;
}


export { BUDGET, escape, LONG };
