import Parser from 'rss-parser';
import fetch from 'cross-fetch';
import schedule from 'node-schedule';

import logger from "@log";

import Database from "@db";
import { Anime } from '@database/entities/Anime';
import { RateableEpisode } from '@database/entities/RateableEpisode';

const parser: Parser = new Parser();

/* A scratch of an RSS item structure with the only fields we'll ever need. */
export interface ItemStructure {
  guid: string;
  link: string;
  title: string;
  pubDate: string;
  /* other fields we don't need [...] */
}

export class DiscoveryService {
  static async getAniListId(item: ItemStructure): Promise<number> {
    const title = this.extractTitle(item.title.trim());

    const response = await fetch("https://graphql.anilist.co", {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
      },
      body: JSON.stringify({
          query: `
            query ($search: String) {
              Media(search: $search, type: ANIME) {
                id,
              }
            }
          `,
          variables: { search: title }
      })
    });

    const result = await response.json();

    if (result?.data?.Media?.id) return result.data.Media.id;
    else return undefined;
  }

  static extractTitle(title: string): string|undefined {
    const expression = /^(.*)\s#([\d-]+)\s*$/g;
    const results = expression.exec(title);

    if (results.length > 1) return results[1]; /* matched title capture group */
    else return undefined;
  }

  static extractEpisode(title: string): string|undefined {
    const expression = /^(.*)\s#([\d-]+)\s*$/g;
    const results = expression.exec(title);

    if (results.length > 1) return results[2]; /* matched episode capture group */
    else return undefined;
  }

  static async getLastFeed(): Promise<[any, Date]|[undefined, undefined]> {
    const lastFeed = await Database.cache.get("discoveryLastFeed");
    const lastFeedTime = await Database.cache.get("discoveryLastFeedTime");

    if (lastFeed) return [ JSON.parse(lastFeed), new Date(lastFeedTime) ];
    else return [ undefined, undefined ];
  }

  static async setLastFeed(lastFeedObject: any, lastFeedTime: Date): Promise<any> {
    await Database.cache.set("discoveryLastFeed", JSON.stringify(lastFeedObject));
    await Database.cache.set("discoveryLastFeedTime", lastFeedTime.toUTCString());

    return lastFeedObject;
  }

  static discover(): void {
    Database.cache.unlink("discoveryLastFeed");

    /*
    * Run every 15th minute of the hour. E.g. 00:00, 00:15, 00:30, 00:45.
    */
    schedule.scheduleJob('*/15 * * * *', async() => {
      try {
        let [ lastFeed, lastFeedTime ] = await this.getLastFeed();

        const modifiedSince = lastFeedTime ? { 'If-Modified-Since': lastFeedTime.toUTCString() } : {};

        /* Fetch the RSS feed only for the first time or if it has changed since last fetch */
        const res = await fetch(process.env.DISCOVERY_RSS_FEED, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...modifiedSince,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
          },
        });

        /* If nothing has changed from last feed */
        if (res.status !== 200) return;

        /* If RSS changed or it's the first time, let's parse it */
        const feed = await parser.parseString(await res.text());

        /* Set last feed if it's the first time */
        if (!lastFeed) {
          lastFeedTime = new Date(feed.lastBuildDate);
          lastFeed = await this.setLastFeed(feed, lastFeedTime);
        }

        /* We look for new items in the RSS by comparing the actual feed and the old feed */
        const newItems: ItemStructure[] = feed.items.filter(i => !lastFeed.items.some(i2 => i2.guid === i.guid)) as ItemStructure[];

        /* We get, for each new item, its AniList id */
        const newItemsWithIds = await Promise.all(
          newItems.map(
            async i => ({
              ...i,
              anilistId: await this.getAniListId(i)
            })
          )
        );

        let dbUpdated = false;

        const bulk = Anime.collection.initializeUnorderedBulkOp();
        if (newItemsWithIds.length > 1) {
          logger.discovery.info(`DiscoveryService discovered ${newItemsWithIds.length} episodes.`);
        }

        const insertedEpisodes = [];
        /* For each new episode out */
        for (const item of newItemsWithIds) {
          /* We don't want episodes for animes that aren't found on AniList */
          if (!item.anilistId) continue;

          /* We lookup if the episode's anime is in database, by AniList id */
          const anime = await Anime.findOne({ anilistId: item.anilistId });

          /* We don't want episodes for animes that aren't in db */
          if (!anime) continue;

          /* We extract the episode number from the RSS item title */
          const episode = this.extractEpisode(item.title);

          /* We add the new episode to the anime episodes list in db */
          if (episode) {
            await bulk
              .find({ _id: anime._id })
              .update({
                $push: {
                  episodes: {
                    episode,
                    ratings: [],
                  } as RateableEpisode
                }
              });

              /* We also add the episode, with its anime title, to a list to log its insertion later */
            insertedEpisodes.push(`${anime.title} #${episode}`);

            dbUpdated = true;
          } else continue;
        }

        if (dbUpdated) {
          const bulkResult = await bulk.execute();
          const updatedCount = bulkResult && bulkResult.modifiedCount ? bulkResult.modifiedCount : 0;

          if (updatedCount > 0) {
            logger.discovery.info(`DiscoveryService inserted ${updatedCount} episode${updatedCount !== 1 ? "s" : ""} in database (${insertedEpisodes.join(", ")}).`);
          } else {
            logger.discovery.info(`DiscoveryService did not insert any of them in database.`);
          }
        } else if (newItemsWithIds.length > 1) {
          logger.discovery.info(`DiscoveryService did not insert any of them in database.`);
        }

        await this.setLastFeed(feed, new Date(feed.lastBuildDate));
      } catch(err) {
        logger.discovery.error(err);
      }
    });
  }
}