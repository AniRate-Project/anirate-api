import { Anime, AnimeType } from "@entities/Anime";
import { RateableEpisode } from "@entities/RateableEpisode";
import { Rating } from "@entities/Rating";

import { NotFoundError, AlreadyDoneError, NotDoneError } from "@errors";

export class AnimeService {
  static async getAnime(id: string): Promise<AnimeType> {
    const anime = await Anime.findById(id).cache(3600, `anime.${id}`).exec();

    if (anime) return anime;
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
    const anime = await this.getAnime(animeId);
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
      score: score
    };
  }

  static async follow(animeId: string, userId: string, follow: boolean = true): Promise<Object> {
    const anime = await this.getAnime(animeId);

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
      title: anime.title,
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

      /* Creating the result object. */
      {
        $project: {
          anilistId: 1,
          title: 1,
          extraTitles: 1,
          episodes: {
            $map: {
              input: "$episodes",
              as: "episode",
              in: {
                episode: "$$episode.episode",
                /* The number of votes of this episode: count(v1, v2, ..., vn).  */
                countScore: {
                  $size: "$$episode.ratings"
                },
                /* The average score of this episode: (v1 + v2 + ... + vn) / (countScore). */
                avgScore: {
                  $avg: "$$episode.ratings.score"
                },
                /* The sum of all the scores of this episode: (v1 + v2 + ... + vn). */
                sumScore: {
                  $sum: "$$episode.ratings.score",
                },
                /* The requesting user's score for this episode, as a Rating object, including user's id, score and date. */
                userScore: {
                  $ifNull: [ // ifnull return null. For some reason $first does not return anything if its array is empty ([]). I want it to return null if the array is empty.
                    {
                      $first: { // using first because filter returns an array, even if we filter for a single element
                        $filter: {
                          input: "$$episode.ratings",
                          as: "rating",
                          cond: {
                            $eq: ["$$rating.user", userId]
                          } 
                        } 
                      }
                    },
                    null
                  ],
                }
              }
            }
          },

          /* A score object for the anime itself which contains some score info for the entire anime. */
          score: {
            /*
            * The number of votes of this anime: (episode1.countScore + episode2.countScore + ... + episodeN.countScore),
            * but calculated not by using the countScore property but manually summing episode ratings arrays sizes.
            */
            countScore: {
              $sum: { 
                $map: {
                  input: "$episodes",
                  as: "episode",
                  in: {
                    $size: "$$episode.ratings"
                  }
                }
              }
            },
          },

          /* A follow object which contains some follow info for the entire anime. */
          follow: {
            /* The number of followers of this anime (followers array size). */
            followersCount: {
              $size: "$followers"
            },
            /* A boolean, meaning if the requesting user currently follows the anime (looking if his ID is in the followers array). */
            userFollowing: {
              $in: [userId, "$followers"]
            },
          },

          /* MongoDB Atlas search's searchHighlights results to use later to find the best matching title between title and extraTitles. */
          bestTitles: {
            $meta: "searchHighlights"
          },
        }
      },

      /* Adding a new field after the projection because we need to use the projection's calculated fields. */
      {
        $addFields: {
          /*
          * The average score for this anime, calculated using a weighted average and not an average of multiple averages.
          * For instance, it is not done using (avg1 + avg2 + ... + avgn) / (num of avgs);
          * instead, it sums all the scores for each episode and divides it by the sum of the number of votes of each episode,
          * like this: (ep1sum + ep2sum + ... + epnsum) / (ep1count + ep2count + ... + epncount).
          * We use $cond to be sure that we don't divide by zero, thus returning 0 and not getting an error.
          */
          "score.avgScore": {
            $cond: [
              {
                $eq: [
                  { $sum: "$episodes.countScore" },
                  0
                ]
              },
              0,
              {
                $divide: [
                  { $sum: "$episodes.sumScore" },
                  { $sum: "$episodes.countScore" }
                ]
              }
            ]
          },

          /*
          * User's average score for this anime, calculated using an average for all his votes for each episode where present.
          * If the user never voted any episode, it'll be null.
          */
          "score.userScore": {
            $ifNull: [
              { $avg: "$episodes.userScore.score" },
              0
            ]
          }
        },
      },
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
