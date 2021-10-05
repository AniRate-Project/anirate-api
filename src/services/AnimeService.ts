import { mongoose } from "@typegoose/typegoose";

import { Anime, AnimeType } from "@entities/Anime";
import { RateableEpisode } from "@entities/RateableEpisode";
import { Rating } from "@entities/Rating";

import { NotFoundError, AlreadyDoneError, NotDoneError } from "@errors";
import animeStructureAggregationPipeline from "@utils/animeStructureAggregationPipeline";

export class AnimeService {
  static async getAnime(id: string, userId?: string): Promise<AnimeType> {
    /*
    * cachedAnime here is an array, because aggregate only returns arrays, even if of a single element.
    * Also, we need to cast the aggregation to any because recachegoose doesn't support TypeScript.
    */
    const cachedAnime = await (Anime.aggregate().match({ _id: new mongoose.Types.ObjectId(id) }).append(animeStructureAggregationPipeline(userId)) as any).cache(3600, `anime.${id}`).exec();

    /*
    * We need to hydrate it because, for some reason,
    * recachegoose returns a POJO instead of an hydrated object.
    */
    if (cachedAnime && cachedAnime[0]) return await Anime.hydrate(cachedAnime[0]);
    else throw new NotFoundError("No anime was found using the provided id.", "NO_ANIME", {
      anime: id,
    });
  }
  
  static async getEpisode(anime: AnimeType, episodeNum: string): Promise<RateableEpisode> {
    const episode = anime.episodes.find(e => e.episode === episodeNum);

    if (episode) return episode;
    else throw new NotFoundError("No episode for the specified anime was found using the provided number.", "NO_EPISODE", {
      anime: anime.id,
      episode: episodeNum
    }); 
  }

  static async voteEpisode(animeId: string, episodeId: string, userId: string, score: number): Promise<Object> {
    const anime = await this.getAnime(animeId, userId);
    const episode = await this.getEpisode(anime, episodeId);

    const userRatingIndex: number = episode.ratings.findIndex(r => r.user === userId);
    if (userRatingIndex > -1) {
      // throw new AlreadyDoneError("The user already rated the provided episode.", "ALREADY_RATED");
      episode.ratings[userRatingIndex].score = score;
    } else {
      episode.ratings.push({
        user: userId,
        score: score,
        date: new Date(),
      } as Rating);
    }

    await anime.save();
    
    return {
      user: userId,
      score: score,
      anime: anime
    };
  }

  static async follow(animeId: string, userId: string, follow: boolean = true): Promise<Object> {
    const anime = await this.getAnime(animeId, userId);

    const userFollowIndex: number = anime.followers.findIndex(u => u === userId);
    if (userFollowIndex > -1) {
      if (follow) throw new AlreadyDoneError("The user already follows the provided anime.", "ALREADY_FOLLOWING", {
        anime: animeId,
        user: userId
      });
      else anime.followers = anime.followers.filter(u => u !== userId);
    } else {
      if (follow) anime.followers.push(userId);
      else throw new NotDoneError("The user doesn't follow the provided anime.", "NOT_FOLLOWING", {
        anime: animeId,
        user: userId
      });
    }

    await anime.save();

    return {
      user: userId,
      following: follow,
      anime: anime
    };
  }

  static async search(query: string, userId: string): Promise<Object> {
    const searchResults = await Anime.aggregate([
      /* Fuzzy searching by query string. */
      {
        $search: {
          index: 'anime title',
          text: {
            query: JSON.stringify(query), // we stringify to avoid NoSQL objects injection.
            path: {
              'wildcard': '*'
            },
            fuzzy: {
              maxExpansions: 100,
            }
          },
          highlight: {
            path: {
              'wildcard': '*'
            },
          }
        }
      },

      /* Limiting results to the first 5, for practicality and performance of the next operations. */
      {
        $limit: 5,
      },

      /* Formatting animes following the common structure */
      ...animeStructureAggregationPipeline(userId, true)
    ]).exec();

    /* Telling, for each anime, the title most matching the search query to display to the user. */
    for (const result of searchResults) {
      /*
      * result.bestTitles is an array of matching titles for the anime, and the first is the most matching.
      * Its "path" field specifies if the title is contained in anime's "title" field or anime's "extraTitles" field.
      */
      result.bestTitle = result[result.bestTitles[0].path];

      /* If the best title is contained in the "extraTitles", being an array, we take its first element for the best title. */
      if (Array.isArray(result.bestTitle)) result.bestTitle = result.bestTitle[0];

      /* We remove the bestTitles object which now is unnecessary for the requesting client. */
      delete result.bestTitles;
    }

    return searchResults;
  }
}
