import { Attributes, Renderable } from '@esportsplus/frontend';


const factory = <
    A extends Attributes,
    C = Renderable<any>,
    Context = { attributes?: A, content?: C }
>(
    template: (this: Context, attributes: Readonly<A>, content: C) => Renderable<any>
) => {
    function factory(): ReturnType<typeof template>;
    function factory<T extends A>(attributes: T): ReturnType<typeof template>;
    function factory<T extends C>(content: T): ReturnType<typeof template>;
    function factory(attributes: A, content: C): ReturnType<typeof template>;
    function factory(this: Context, one?: A | C, two?: C): ReturnType<typeof template> {
        let attributes: A = {} as A,
            content: C;

        if (two === undefined) {
            if (typeof one === 'object') {
                attributes = one as A;
                content = null as C;
            }
            else {
                content = one as C;
            }
        }
        else {
            attributes = one as A;
            content = two;
        }

        return template.call(this, attributes, content);
    }

    return factory;
};


export default { factory };