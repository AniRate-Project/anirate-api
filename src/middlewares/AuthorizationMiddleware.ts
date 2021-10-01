import { Request, Response, NextFunction } from 'express';

import { Role } from '@core/Role';
import { AuthorizationError, HttpError } from '@core/errors';

export function AuthorizationMiddleware(role: Role) {
  return async function(req: Request, res: Response, next: NextFunction) {
    let error: HttpError;
    switch(role) {
      default:
      case Role.CLIENT:
        break;
      case Role.BOT:
        if (!req.header("Authorization")) error = new AuthorizationError("This endpoint requires the Authorization header.", "AUTHORIZATION_MISSING");
        else if (!req.header("Authorization").startsWith("Mutual")) error = new AuthorizationError("This endpoint requires the Mutual authentication scheme.", "AUTHORIZATION_WRONG_SCHEME");
        else if (req.header("Authorization").split(" ")[1] !== process.env.BOT_PASSWORD) error = new AuthorizationError("This endpoint requires BOT level authorization.", "AUTHORIZATION_BOT");
        break;
    }

    if (error) {
      error.respond(res);
      error.log();

      return;
    }

    return next();
  }
}