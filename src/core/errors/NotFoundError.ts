import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class NotFoundError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.WARN;
  public readonly name: string = "NotFoundError";
  public static readonly statusCode: number = 404;

  constructor(message: string, type: string, data?: any) {
    super(NotFoundError.statusCode, message, type, data);
  }
}