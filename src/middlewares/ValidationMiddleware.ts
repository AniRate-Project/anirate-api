import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';

import { ValidationError } from '@core/errors/ValidationError';

export function ValidationMiddleware(validators: ValidationChain[]) {
  return async function(req: Request, res: Response, next: NextFunction) {
    for (const validator of validators) {
      await validator.run(req);
    }

    const errors = await validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];

      const validationError = new ValidationError(`'${firstError.param}' field in ${firstError.location} ${firstError.msg}`);
      validationError.respond(res);
      validationError.log();

      return;
    }

    return next();
  }
}