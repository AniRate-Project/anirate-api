export default function animeStructureAggregationPipeline(userId?: string, isSearch: boolean = false) {
  const bestTitles = (isSearch ? 
    {
      bestTitles: {
        $meta: "searchHighlights"
      }
    }
    :
    {}
  );
  
  const ratings = (!isSearch ?
    {
      ratings: "$$episode.ratings",
    }
    :
    {}
  );

  return [
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
              ...ratings,
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
              userScore: (userId ? {
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
              } : 0)
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
            $in: [userId || null, "$followers"]
          },
        },
    
        /* MongoDB Atlas search's searchHighlights results to use later to find the best matching title between title and extraTitles. */
        ...bestTitles
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
        * If the user never voted any episode, it'll be 0.
        */
        "score.userScore": (userId ? {
          $ifNull: [
            { $avg: "$episodes.userScore.score" },
            0
          ]
        } : 0)
      }
    }
  ];
}