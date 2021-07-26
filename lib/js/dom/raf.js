let raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || function (fn) {
        return window.setTimeout(fn, (1000 / 60));
    };

let scheduled = false,
    tasks = {
        read: [],
        update: []
    };


function frame() {
    process(tasks.read.splice(0));
    process(tasks.update.splice(0));

    scheduled = false;
    schedule();
}

function process(tasks) {
    for (let i = 0, n = tasks.length; i < n; i++) {
        tasks[i]();
    }
}

function schedule() {
    if (scheduled || (tasks.read.length + tasks.update.length) === 0) {
        return;
    }

    raf(frame);
    scheduled = true;
}


const read = (fn) => {
    tasks.read.push(fn);
    schedule();
};

const update = (fn) => {
    tasks.update.push(fn);
    schedule();
};


export default { read, update };
