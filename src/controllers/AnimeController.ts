import { Request, Response } from 'express';
import { Controller, Delete, Get, Middleware, Put } from '@overnightjs/core';
import { param, body, query } from 'express-validator';

import logger from "@log";

import { InternalServerError } from '@core/errors/InternalServerError';
import { ResponseSuccess } from "@core/ResponseType";
import { Role } from '@core/Role';
import { AnimeService } from '@services/AnimeService';
import { AuthorizationMiddleware } from '@middlewares/AuthorizationMiddleware';
import { ValidationMiddleware } from '@middlewares/ValidationMiddleware';

@Controller('api/anime')
export class AnimeController {
  async handleError(err: any, res: Response) {
    if (err.isHttp) {
      err.log();
      err.respond(res);
    } else {
      logger.app.error(err);
      return new InternalServerError().respond(res);
    }
  }

  @Put(':anime/:episode/vote')
  @Middleware([
    AuthorizationMiddleware(Role.BOT),
    ValidationMiddleware([
      body('user').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string").matches(/\d/).withMessage("must be a Discord User ID"),
      body('score').exists({ checkNull: true, checkFalsy: true }).withMessage("must be provided").isFloat({ min: 1, max: 10 }).withMessage("must be a number between 1 and 10"),
      param('anime').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
      param('episode').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
    ])
  ])
  async vote(req: Request, res: Response) {
    const { anime, episode } = req.params;
    const { user, score } = req.body;

    try {
      const voteResponse: Object = await AnimeService.voteEpisode(anime, episode, user, score);

      return new ResponseSuccess(201, voteResponse).respond(res);
    } catch(err) {
      this.handleError(err, res);
    }
  }

  @Put(':anime/follow')
  @Middleware([
    AuthorizationMiddleware(Role.BOT),
    ValidationMiddleware([
      body('user').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string").matches(/\d/).withMessage("must be a Discord User ID"),
      param('anime').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
    ])
  ])
  async follow(req: Request, res: Response) {
    const { anime } = req.params;
    const { user } = req.body;

    try {
      const voteResponse: Object = await AnimeService.follow(anime, user, true);

      return new ResponseSuccess(200, voteResponse).respond(res);
    } catch(err) {
      this.handleError(err, res);
    }
  }

  @Delete(':anime/follow')
  @Middleware([
    AuthorizationMiddleware(Role.BOT),
    ValidationMiddleware([
      body('user').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string").matches(/\d/).withMessage("must be a Discord User ID"),
      param('anime').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
    ])
  ])
  async unfollow(req: Request, res: Response) {
    const { anime } = req.params;
    const { user } = req.body;

    try {
      const voteResponse: Object = await AnimeService.follow(anime, user, false);

      return new ResponseSuccess(200, voteResponse).respond(res);
    } catch(err) {
      this.handleError(err, res);
    }
  }

  @Get('search')
  @Middleware([
    AuthorizationMiddleware(Role.BOT),
    ValidationMiddleware([
      query('user').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string").matches(/\d/).withMessage("must be a Discord User ID"),
      query('query').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
    ])
  ])
  async search(req: Request, res: Response) {
    let { query, user } = req.query;

    if (Array.isArray(query)) query = query[0];
    else query = query.toString();

    if (Array.isArray(user)) user = user[0];
    else user = user.toString();

    try {
      const searchResponse: Object = await AnimeService.search(query as string, user as string);

      return new ResponseSuccess(200, searchResponse).respond(res);
    } catch(err) {
      this.handleError(err, res);
    }
  }

  @Get(':anime/:field?')
  @Middleware([
    AuthorizationMiddleware(Role.BOT),
    ValidationMiddleware([
      param('anime').not().isEmpty().withMessage("must not be empty").isString().withMessage("must be a string"),
      param('field').optional({ nullable: true, checkFalsy: true }).isString().withMessage("must be a string"),
      query('user').optional({ nullable: true, checkFalsy: true }).isString().withMessage("must be a string").matches(/\d/).withMessage("must be a Discord User ID"),
    ])
  ])
  async get(req: Request, res: Response) {
    const { anime, field } = req.params;
    const { user } = req.query;

    try {
      const animeObject = await AnimeService.getAnime(anime, user ? user.toString() : undefined);

      /* We can't use hasOwnProperty here, because it's not a POJO but most likely a Mongoose getter. */
      if (field && field in animeObject) return new ResponseSuccess(200, animeObject[field]).respond(res);
      else return new ResponseSuccess(200, animeObject).respond(res);
    } catch(err) {
      this.handleError(err, res);
    }
  }
}
