import events from '@esportsplus/delegated-events';


let initialized = false,
    queue: VoidFunction[] = [];


const onclick = (fn: VoidFunction) => {
    if (!initialized) {
        events.register(document.body, 'click', async () => {
            if (!queue.length) {
                return;
            }

            let items = queue.splice(0);

            for (let i = 0, n = items.length; i < n; i++) {
                await items[i]();
            }
        });
        initialized = true;
    }

    queue.push(fn);
};


export default { onclick };