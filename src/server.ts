import express from 'express';
import compression from 'compression';
import { Server } from '@overnightjs/core';

import logger from "@log";

import controllers from '@controllers';

export class APIServer extends Server {
  constructor() {
    super(process.env.NODE_ENV === 'development');

    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    super.addControllers([ ...controllers.map(c => new c()) ]);
  }

  public announceStart(port: number) {
    logger.web.info(`Server started on port ${port}.`);
  }

  public start(port: number): void {
    this.app.listen(port, this.announceStart.bind(this, [ port ]));
  }
}