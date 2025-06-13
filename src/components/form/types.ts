import response, { Response } from '@esportsplus/action';
// import alert from '~/components/alert';


type Action = (data: Payload) => Promise<Errors> | Errors;

type Errors = { errors: Response<unknown>['errors'] };

type Payload = {
    alert: typeof alert;
    input: Record<string, any>;
    response: typeof response;
};


export type { Action, Errors, Payload };