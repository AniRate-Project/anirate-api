import { ErrorLogLevel } from "@log";

import { HttpError } from "./HttpError";

export class ValidationError extends HttpError {
  public readonly logLevel: ErrorLogLevel = ErrorLogLevel.WARN;
  public readonly name: string = "ValidationError";
  public static readonly statusCode: number = 400;
  public static readonly type: string = "VALIDATION_ERROR";

  constructor(message: string, data?: any) {
    super(ValidationError.statusCode, message, ValidationError.type, data);
  }
}