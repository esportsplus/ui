import response, { Response } from '@esportsplus/action';


type Action = (data: Payload) => Promise<Errors> | Errors;

type Errors = { errors: Response<unknown>['errors'] };

type Payload = {
    input: Record<string, any>;
    response: typeof response;
};


export type { Action, Errors, Payload };