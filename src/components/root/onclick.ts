let queue: (VoidFunction | (() => Promise<void>))[] = [];


const onclick = async () => {
    if (queue.length === 0) {
        return;
    }

    let item;

    while (item = queue.pop()) {
        await item();
    }
};

onclick.push = (fn: VoidFunction) => {
    queue.push(fn);
};


export default onclick;