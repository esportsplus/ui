let queue: VoidFunction[] = [];


const onclick = async () => {
    if (queue.length === 0) {
        return;
    }

    let item;

    while (item = queue.pop()) {
        await item();
    }
};

onclick.add = (fn: VoidFunction) => {
    queue.push(fn);
};


export default onclick;