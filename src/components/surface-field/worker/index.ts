import { onmessage, type Actions as Handlers, type WorkerContext } from '@esportsplus/workers';
import engine, { scheduler } from '../engine';


type Actions = typeof actions;

type Call = [keyof Field, unknown[]];

type Field = ReturnType<typeof engine>;


let actions = {
    // Draws one field on its transferred canvas for as long as the task is retained; the page streams its input
    // through `port`, a batch of calls per frame.
    attach(this: WorkerContext, canvas: OffscreenCanvas, port: MessagePort) {
        let field = engine(canvas, scheduler());

        port.onmessage = (event: MessageEvent<Call[]>) => {
            let calls = event.data;

            for (let i = 0, n = calls.length; i < n; i++) {
                let [name, args] = calls[i];

                (field[name] as (...args: unknown[]) => void)(...args);
            }
        };

        this.retain(() => {
            field.dispose();
            port.close();
        });
    }
};


// `Handlers` types every action as taking `unknown` arguments, which typed parameters cannot satisfy; the typed
// shape is what the page's pool infers its calls from.
onmessage(actions as unknown as Handlers);


export type { Actions, Call, Field };
