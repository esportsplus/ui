import { pageHead } from 'docs/components/page/head';
import { html } from 'docs/app';
import { themes } from 'docs/data/scss';
import { preview } from 'docs/components/preview';
import type { Renderable, Router } from 'docs/app';
import type { Page, TocItem } from 'docs/types';


type Entry = {
    component: string;
    id: string;
    label: string;
    theme: string;
    variables: Variable[];
};

type Variable = {
    name: string;
    value: string;
};


const CSS_VARIABLE = /(--[\w-]+)\s*:\s*([^;]+);/g;


function demo(component: string): Renderable<unknown> | null {
    if (component === 'button') {
        return html`
            <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                <div class='button button--primary' style='--width: auto;'>Primary</div>
                <div class='button button--secondary' style='--width: auto;'>Secondary</div>
                <div class='button button--tertiary' style='--width: auto;'>Tertiary</div>
            </div>
        `;
    }

    if (component === 'link') {
        return html`<a class='link' href='#/themes'>A themed link</a>`;
    }

    return null;
}

function entries(): Entry[] {
    return themes().map((entry) => ({
        component: entry.component,
        id: `${entry.theme}-${entry.component}`,
        label: `${entry.theme} / ${entry.component}`,
        theme: entry.theme,
        variables: variables(entry.source)
    }));
}

function variables(source: string): Variable[] {
    let matches = [...source.matchAll(CSS_VARIABLE)],
        out: Variable[] = [],
        seen = new Set<string>();

    for (let match of matches) {
        let name = match[1];

        if (seen.has(name)) {
            continue;
        }

        seen.add(name);
        out.push({ name, value: match[2].trim() });
    }

    return out;
}


const responder = (): Page => {
    let rendered = entries(),
        toc: TocItem[] = rendered.map((entry) => ({ id: entry.id, label: entry.label }));

    return {
        render: () => html`
            <div class='page'>
                ${pageHead({ title: 'Themes', description: 'A theme is a set of CSS custom property overrides layered over the base component styles. Build your own by redefining the same variables listed below.' })}

                ${rendered.map((entry) => html`
                    <section id='${entry.id}'>
                        <h2 class='page-section-title'>${entry.label}</h2>

                        ${() => {
                            let content = demo(entry.component);

                            if (content === null) {
                                return '';
                            }

                            return preview(null, content);
                        }}

                        <div class='spec-table-scroll'><table class='spec-table'>
                            <thead class='table-head'>
                                <tr><th>Variable</th><th>Value</th></tr>
                            </thead>
                            <tbody>
                                ${entry.variables.map((variable) => html`
                                    <tr>
                                        <td class='spec-name'>${variable.name}</td>
                                        <td class='spec-value'>${variable.value}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table></div>
                    </section>
                `)}
            </div>
        `,
        toc
    };
};


export default (r: Router) => r
    .get({ name: 'themes', path: '/themes', responder });
