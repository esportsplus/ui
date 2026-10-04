import { html, type Renderable } from '@esportsplus/template';
import { safeUrl } from './model';

const allowed = new Set([
    'p',
    'div',
    'span',
    'br',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    's',
    'del',
    'code',
    'pre',
    'blockquote',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'details',
    'summary',
    'sup',
    'sub'
]);
const discard = new Set([
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'svg',
    'math',
    'template',
    'noscript',
    'base',
    'link',
    'meta',
    'form',
    'input',
    'button',
    'textarea',
    'select'
]);

/** Parse inertly, project a strict allowlist, then render through compiled templates.
 * Source HTML is never assigned to a live element or template raw-HTML slot. */
export function renderSafeHtml(source: string, dom: Document): Renderable<unknown> {
    let parser = new dom.defaultView!.DOMParser(),
        parsed = parser.parseFromString(source, 'text/html');
    function node(value: Node, depth: number): Renderable<unknown> {
        if (depth > 40) return '';
        if (value.nodeType === 3) return value.textContent ?? '';
        if (value.nodeType !== 1) return '';
        let element = value as HTMLElement,
            tag = element.localName.toLowerCase();
        if (discard.has(tag)) return '';
        let children = [...element.childNodes].map((child) => node(child, depth + 1));
        if (!allowed.has(tag)) return children;
        let attributes: Record<string, string> = {},
            title = element.getAttribute('title');
        if (title) attributes.title = title;
        if (tag === 'a') {
            let href = safeUrl(element.getAttribute('href') ?? '');
            if (href) attributes.href = href;
            attributes.rel = 'noopener noreferrer';
        }
        if (tag === 'img') {
            let src = safeUrl(element.getAttribute('src') ?? '', true);
            if (!src) return element.getAttribute('alt') ?? '';
            attributes.src = src;
            attributes.alt = element.getAttribute('alt') ?? '';
            attributes.loading = 'lazy';
        }
        // Static tags let the template compiler own every resulting UI node.
        switch (tag) {
            case 'a':
                return html`<a ${attributes}>${children}</a>`;
            case 'img':
                return html`<img ${attributes}>`;
            case 'p':
                return html`<p ${attributes}>${children}</p>`;
            case 'div':
                return html`<div ${attributes}>${children}</div>`;
            case 'span':
                return html`<span ${attributes}>${children}</span>`;
            case 'strong':
            case 'b':
                return html`<strong ${attributes}>${children}</strong>`;
            case 'em':
            case 'i':
                return html`<em ${attributes}>${children}</em>`;
            case 's':
            case 'del':
                return html`<s ${attributes}>${children}</s>`;
            case 'code':
                return html`<code ${attributes}>${children}</code>`;
            case 'pre':
                return html`<pre ${attributes}>${children}</pre>`;
            case 'blockquote':
                return html`<blockquote ${attributes}>${children}</blockquote>`;
            case 'ul':
                return html`<ul ${attributes}>${children}</ul>`;
            case 'ol':
                return html`<ol ${attributes}>${children}</ol>`;
            case 'li':
                return html`<li ${attributes}>${children}</li>`;
            case 'h1':
                return html`<h1 ${attributes}>${children}</h1>`;
            case 'h2':
                return html`<h2 ${attributes}>${children}</h2>`;
            case 'h3':
                return html`<h3 ${attributes}>${children}</h3>`;
            case 'h4':
                return html`<h4 ${attributes}>${children}</h4>`;
            case 'h5':
                return html`<h5 ${attributes}>${children}</h5>`;
            case 'h6':
                return html`<h6 ${attributes}>${children}</h6>`;
            case 'table':
                return html`<table ${attributes}>${children}</table>`;
            case 'thead':
                return html`<thead ${attributes}>${children}</thead>`;
            case 'tbody':
                return html`<tbody ${attributes}>${children}</tbody>`;
            case 'tr':
                return html`<tr ${attributes}>${children}</tr>`;
            case 'th':
                return html`<th ${attributes}>${children}</th>`;
            case 'td':
                return html`<td ${attributes}>${children}</td>`;
            case 'details':
                return html`<details ${attributes}>${children}</details>`;
            case 'summary':
                return html`<summary ${attributes}>${children}</summary>`;
            case 'sup':
                return html`<sup ${attributes}>${children}</sup>`;
            case 'sub':
                return html`<sub ${attributes}>${children}</sub>`;
            case 'br':
                return html`<br>`;
            case 'hr':
                return html`<hr>`;
        }
        return children;
    }
    return [...parsed.body.childNodes].map((child) => node(child, 0));
}
