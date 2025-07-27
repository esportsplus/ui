import { Renderable } from '@esportsplus/template';


const factory = <A extends Record<string, unknown>, C = unknown>(template: (attributes: A, content: C) => Renderable) => {
    function factory(content: C): Renderable;
    function factory(attributes: A, content: C): Renderable;
    function factory(one: A | C, two?: C): Renderable {
        let content: C,
            attributes: A = {} as A;

        if (two === undefined) {
            content = one as C;
        }
        else {
            content = two;
            attributes = one as A;
        }

        return template(attributes, content);
    }

    return factory;
};


export default { factory };