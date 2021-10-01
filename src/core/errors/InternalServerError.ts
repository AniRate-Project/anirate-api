import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class InternalServerError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.ERROR;
  public readonly name: string = "InternalServerError";
  public static readonly statusCode: number = 500;
  public static readonly defaultMessage: string = "An internal server error happened. Check server logs to know more about.";
  public static readonly defaultType: string = "INTERNAL_SERVER";

  constructor(message: string = InternalServerError.defaultMessage, type: string = InternalServerError.defaultType) {
    super(InternalServerError.statusCode, type, message);
  }
}