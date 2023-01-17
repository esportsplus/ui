import { Response } from '@esportsplus/action';


type Action = <T>(data: T) => Promise<Errors> | Errors;

type Errors = { errors: Response<unknown>['errors'] };


export { Action, Errors };