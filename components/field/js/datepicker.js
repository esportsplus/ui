/**
 *------------------------------------------------------------------------------
 *
 *  Datepicker
 *  - Saves Timestamp As Unix Timestamp ( In Seconds ) For PHP
 *
 */

import { state } from 'ui/components';
import { directive, dom, emitter, node, render } from 'ui/lib';


let months = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'
    ],
    read = {
        day: (target) => (target ? (target.dataset.day || false) : false),
        hour: (hour, meridiem) => (parseInt(hour.value) + (meridiem.value.toLowerCase() === 'pm' ? 12 : 0)),
        minute: (minute) => (parseInt(minute.value) || 0),
        month: (month) => months.indexOf(month.value),
        unix: (unix) => (parseInt(unix.value) * 1000),
        year: (year) => parseInt(year.value)
    },
    ref = { mount: 'field.datepicker.mount' },
    template = {
        break: () => {
            return `<div class='field-datepicker-break'></div>`;
        },
        day: (classlist, date, isOffset, selected) => {
            if (selected) {
                classlist += ' --active';
            }

            return `
                <div class='field-datepicker-day field-datepicker-day--square ${isOffset ? 'field-datepicker-day--adj-month' : classlist}' ${isOffset ? '' : `data-day='${date.getDate()}'`}>
                    <span class='field-datepicker-day-number'>${date.getDate()}</span>
                </div>
            `;
        }
    },
    write = {
        day: (date) => date.getDate(),
        hour: (date) => (date.getHours() > 12 ? date.getHours() - 12 : date.getHours()),
        meridiem: (date) => (date.getHours() > 12 ? 'PM' : 'AM'),
        minute: (date) => (date.getMinutes() === 0 ? '00' : date.getMinutes()),
        month: (date) => months[date.getMonth()],
        unix: (date) => (date.getTime() / 1000),
        year: (date) => date.getFullYear()
    };


function build(classlist, date, month, year) {
    let building = true,
        control = new Date(year, month + 1, 0),
        current = new Date(year, month, 1),
        i = 0;

    if (current.getDay() !== 0) {
        i = 0 - current.getDay();
    }

    let rows = '',
        row = '';

    while (building) {
        if (current.getDay() === 6) {
            rows += `${row} ${template.break()}`;
            row = '';
        }

        current = new Date(year, month, ++i);
        row += template.day(classlist, current, (i < 1 || +current > +control), (
            current.getFullYear() === date.getFullYear() &&
            current.getMonth() === date.getMonth() &&
            current.getDate() === date.getDate()
        ));

        if (+control < +current && current.getDay() === 0) {
            building = false;
        }
    }

    return render.html(rows);
}

function update(modified, target) {
    let { container, hour, mask, meridiem, minute, month, unix, year } = this.get('refs.field.datepicker.tags', {}),
        date = new Date( read.unix(unix) );

    if (!date.getTime()) {
        date = new Date();
    }

    let original = new Date( date.getTime() );

    if (modified === 'day') {
        let day = read.day(target);

        if (!day) {
            return;
        }

        date.setDate( day );
    }

    if (['calendar', 'day'].includes(modified)) {
        date.setMonth( read.month(month) );
        date.setFullYear( read.year(year) );
    }

    if (['day', 'time'].includes(modified)) {
        date.setHours( read.hour(hour, meridiem) );
        date.setMinutes( read.minute(minute) );
    }

    if (!date.getTime()) {
        return;
    }

    dom.update(() => {
        if (modified === 'calendar') {
            node.html(container, {
                inner: build(dom.ref(container).get('field.datepicker.class', ''), original, date.getMonth(), date.getFullYear())
            });
        }
        else if (modified === 'day') {
            state.activate(target);
            state.deactivate(node.siblings(target));
        }

        if (date.getTime() === original.getTime()) {
            return;
        }

        if (['day', 'time'].includes(modified)) {
            mask.value = `${write.month(date)} ${write.day(date)}, ${write.year(date)}` + (hour ? ` at ${write.hour(date)}:${write.minute(date)} ${write.meridiem(date)}` : ``);
            unix.value = write.unix(date);
        }
    });
}


const calendar = function(e) {
    update.call(this, 'calendar', e.target);
};

const day = function(e) {
    update.call(this, 'day', e.target);
};

const mount = () => {
    let elements = dom.ref(ref.mount, true) || [];

    for (let i = 0, n = elements.length; i < n; i++) {
        dom.update(() => {
            let element = elements[i],
                fields = element.get('refs.field.datepicker.fields', {}),
                tags = element.get('refs.field.datepicker.tags', {}),
                date = new Date( read.unix(tags.unix) );

            if (date.getTime()) {
                ['hour', 'meridiem', 'minute', 'month', 'year'].forEach((key) => {
                    directive.dispatch('field.select.update', [write[key](date)], fields[key]);
                });
            }

            update.call(element, 'calendar', null);
        });
    }
};

const time = function(e) {
    update.call(this, 'time', e.target);
};


directive.on('field.datepicker.calendar', calendar);
directive.on('field.datepicker.day', day);
directive.on('field.datepicker.time', time);
emitter.on('components.mount', mount);
