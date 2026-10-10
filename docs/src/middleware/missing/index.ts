import { html } from 'docs/app';
import { modifiers } from 'docs/data/modifiers';
import { entries } from 'docs/examples';
import type { Request, Responder, RouteName } from 'docs/app';
import header from 'docs/components/page/header';


const lookup: Partial<Record<RouteName, { label: string, names: Set<string> }>> = {
    'components.detail': { label: 'component', names: new Set(entries.map((entry) => entry.name)) },
    'modifiers.detail': { label: 'modifier', names: new Set(modifiers.map((modifier) => modifier.name)) }
};


export default (request: Request, next: Responder) => {
    let slug = request.data.parameters?.slug ?? '',
        target = lookup[request.data.route?.name as RouteName];

    if (!target || target.names.has(slug)) {
        return next(request);
    }

    return {
        render: () => html`
            <div class='page'>
                ${header({ title: 'Not found', description: `No ${target.label} named "${slug}".` })}
            </div>
        `,
        toc: []
    };
};
