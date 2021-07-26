import { alert } from 'ui/components';
import { directive, dom } from 'ui/lib';


function processing(button, processing) {
    if (!button) {
        return;
    }

    dom.update(() => {
        button.classList.toggle('button--processing', processing);
    });
}


const onchange = function() {
    let button = this.get('refs.upload.button'),
        form = new FormData(),
        request = new XMLHttpRequest();

    processing(button, true);

    form.append(this.element.name, this.element.files[0]);

    request.onreadystatechange = () => {
        if (request.readyState != 4 || request.status != 200) {
            return;
        }

        let response = JSON.parse(request.response);

        if (response.success) {
            directive.dispatch('upload.update', {}, this);
        }

        alert.messages(response.messages || {});

        processing(button, false);
    };
    request.open(this.element.form.method, this.element.form.action);
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    request.send(form);
};


directive.on('upload.onchange', onchange);
