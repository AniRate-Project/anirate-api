import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class AlreadyDoneError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.WARN;
  public readonly name: string = "AlreadyDoneError";
  public static readonly statusCode: number = 400;

  constructor(message: string, type: string, data?: any) {
    super(AlreadyDoneError.statusCode, message, type, data);
  }
}