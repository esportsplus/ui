import { redirect } from 'docs/app';
import type { Request, Responder } from 'docs/app';


export default (request: Request, next: Responder) => {
    // `/`, empty and unmatched paths all resolve to the unnamed fallback route.
    if (request.data.route?.name !== null) {
        return next(request);
    }

    redirect('components');
};
