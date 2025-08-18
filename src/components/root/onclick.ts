import factory from '@esportsplus/queue';


let queue = factory<VoidFunction | (() => Promise<void>)>(64);


const onclick = async () => {
    let item;

    while (item = queue.next()) {
        await item();
    }
};

onclick.push = (fn: VoidFunction) => {
    queue.add(fn);
};


export default onclick;