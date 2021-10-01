import { Response } from 'express';

export abstract class ResponseGeneric {
  public readonly abstract statusCode: number;

  abstract get json(): any;

  respond(res: Response) {
    res.status(this.statusCode).json(this.json);
  }
}

export class ResponseSuccess extends ResponseGeneric {
  constructor(
    public readonly statusCode: number = 200,
    public readonly data?: any,
  ) {
    super();
  }

  get json() {
    return {
      statusCode: this.statusCode,
      error: false,
      data: this.data ?? undefined,
      timestamp: new Date().toISOString()
    };
  }
}

export class ResponseError extends ResponseGeneric {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly type: string
  ) {
    super();
  }

  get json() {
    return {
      statusCode: this.statusCode,
      error: true,
      message: this.message,
      type: this.type,
      timestamp: new Date().toISOString()
    };
  }
}