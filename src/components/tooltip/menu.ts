import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import onclick from './onclick';


type A = Attributes & {
    options: (Attributes & { content: Renderable<unknown> })[],
    option?: Attributes,
    state?: { active: boolean },
    toggle?: boolean,
    'tooltip-content': Attributes & { direction?: string }
};


const OMIT = ['options', 'option', 'tooltip-content'];

const OMIT_OPTION = ['content'];

const OMIT_TOOLTIP_CONTENT = ['direction'];


export default template.factory<A>(
    (attributes, content) => {
        let options = attributes.options,
            option = attributes.option,
            tooltipContent = attributes?.['tooltip-content'],
            tooltipContentDirection = tooltipContent?.direction || 'nw';

        return onclick(
            omit(attributes, OMIT),
            html`
                ${content}

                <div
                    class='tooltip-content ${`tooltip-content--${tooltipContentDirection}`}'
                    ${tooltipContent && omit(tooltipContent, OMIT_TOOLTIP_CONTENT)}
                >
                    ${options.map((o) => html`
                        <div
                            class='link --width-full'
                            ${omit(o, OMIT_OPTION)}
                            ${option}
                        >
                            ${o.content}
                        </div>
                    `)}
                </div>
            `
        );
    }
);
