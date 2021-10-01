import { Response } from 'express';

import logger, { ErrorLogLevel } from "@log";
import { ResponseError } from "@core/ResponseType";

export class ResponseBasedError extends Error {
  protected logLevel: ErrorLogLevel = ErrorLogLevel.WARN;
  private readonly _responseError: ResponseError;

  constructor(public statusCode: number, public message: string, public type: string, public data?: any) {
    super(message);
    
    this._responseError = new ResponseError(this.statusCode, this.message, this.type);
  }

  get responseError() {
    return this._responseError;
  }

  get json() {
    return this._responseError.json;
  }

  respond(res: Response) {
    return this._responseError.respond(res);
  }

  log(level: ErrorLogLevel = this.logLevel) {
    switch(level) {
      case ErrorLogLevel.IGNORE:
        return;

      case ErrorLogLevel.WARN:
        logger.httpError.warn(this);
        break;
      
      default:
      case ErrorLogLevel.ERROR:
        logger.httpError.error(this);
        break;
      
      case ErrorLogLevel.FATAL:
        logger.httpError.fatal(this);
        break;
    }
  }
}

export class HttpError extends ResponseBasedError {
  readonly isHttp: boolean = true;

  constructor(public statusCode: number, public message: string, public type: string, public data?: any) {
    super(statusCode, message, type, data);
  }
}