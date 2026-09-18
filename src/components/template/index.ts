import { Attributes, Renderable } from '@esportsplus/template';
import { isObject } from '@esportsplus/utilities';


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
            content: C = null as C;

        if (arguments.length >= 2) {
            attributes = one as A;
            content = two as C;
        }
        else if (arguments.length === 1) {
            if (isObject(one)) {
                attributes = one as A;
            }
            else {
                content = one as C;
            }
        }

        return template.call(this, attributes, content);
    }

    return factory;
};


export default { factory };