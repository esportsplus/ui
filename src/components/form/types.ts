import { response, Response } from '@esportsplus/action';
import alert from '~/components/alert';


type Action = (data: Payload) => Promise<Errors> | Errors;

type Errors = { errors: Response<unknown>['errors'] };

type Payload = {
    alert: typeof alert;
    input: Record<string, any>;
    response: typeof response;
    processing: {
        end: (deactivate: boolean) => void;
        start: VoidFunction;
    }
};


export { Action, Errors, Payload };