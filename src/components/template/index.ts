import { Attributes, Renderable } from '@esportsplus/template';
import { EMPTY_OBJECT } from '@esportsplus/utilities';


const factory = <
    A extends Attributes,
    C = Renderable<unknown>,
    Context = { attributes?: A, content?: C }
>(
    template: (this: Context, attributes: Readonly<A>, content: C) => Renderable<unknown>
) => {
    function factory(): Renderable<unknown>;
    function factory(content: C): Renderable<unknown>;
    function factory(attributes: A, content: C): Renderable<unknown>;
    function factory(this: Context, one?: A | C, two?: C): Renderable<unknown> {
        let attributes: A = {} as A,
            content: C;

        if (two === undefined) {
            content = one as C;
        }
        else {
            attributes = one as A;
            content = two;
        }

        return template.call(this, attributes, content);
    }

    return factory.bind(EMPTY_OBJECT);
};


export default { factory };