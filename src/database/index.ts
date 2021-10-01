import { mongoose } from "@typegoose/typegoose";
import cachegoose from "recachegoose";
import CachemanRedis from "@ostai/cacheman-redis";
import Redis from "ioredis";

import isProdEnv from "@core/isProdEnv";

export class Database {
  connected: boolean = false;
  private _cache: Redis.Redis;

  async connect() {
    await mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`);
    
    this._cache = new Redis({
      port: <number> <unknown> process.env.CACHE_PORT,
      host: process.env.CACHE_HOST,
      password: process.env.CACHE_PASSWORD,
      db: 0,
    });

    cachegoose(mongoose, {
      engine: new CachemanRedis(this._cache),
    });

    this.connected = true;
  }

  /* Clears cache that needs to be cleared on startup, only for dev mode, to simplify development */
  async clearBootstrapCache() {
    if (!isProdEnv()) {
      await this.cache.unlink("discoveryLastFeed");
      await this.cache.unlink("discoveryLastFeedTime");
    }
  }

  get cache(): Redis.Redis {
    return this._cache;
  }
}

export default new Database();
