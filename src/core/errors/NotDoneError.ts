import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class NotDoneError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.WARN;
  public readonly name: string = "NotDoneError";
  public static readonly statusCode: number = 400;

  constructor(message: string, type: string, data?: any) {
    super(NotDoneError.statusCode, message, type, data);
  }
}