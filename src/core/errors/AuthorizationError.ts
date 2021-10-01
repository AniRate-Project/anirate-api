import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class AuthorizationError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.ERROR;
  public readonly name: string = "AuthorizationError";
  public static readonly statusCode: number = 403;

  constructor(message: string, type: string, data?: any) {
    super(AuthorizationError.statusCode, message, type, data);
  }
}