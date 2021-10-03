import '../imports';

/* Import logger */
import logger from "@log";

/* Import database */
import Database from "@db";

import { Anime } from "@database/entities/Anime";
import { Season } from "@database/entities/Season";

import fetch from 'cross-fetch';

type MediaSeason = "WINTER"|"SPRING"|"SUMMER"|"FALL";
interface AnimeObject {
  id: number;
  title: {
    romaji?: string;
    english?: string;
  },
  seasonYear: number,
  season: MediaSeason
};

const currentYear: number = parseInt(process.env.CURRENT_YEAR);
if (!currentYear || isNaN(currentYear) || currentYear < new Date().getFullYear()) {
  logger.scripts.error(`CURRENT_YEAR env was not found or is not a correct year.`);
}

const currentSeason: MediaSeason = process.env.CURRENT_SEASON as MediaSeason;
if (!currentSeason) {
  logger.scripts.error(`CURRENT_SEASON env was not found or is not a correct season.`);
}

async function queryAniListForSeason(): Promise<AnimeObject[]> {
  let animes: AnimeObject[] = [];

  /* Max of 25 pages (625 animes per season, should be enough and hopefully never reached, except if weebs were to conquer the world) */
  for(let currentPage = 1; currentPage <= 25; currentPage++) {
    const response = await fetch("https://graphql.anilist.co", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: `
              query ($page: Int, $perPage: Int, $year: Int, $season: MediaSeason) {
                Page (page: $page, perPage: $perPage) {
                  pageInfo {
                    total
                    currentPage
                    lastPage
                    hasNextPage
                    perPage
                  }
                  media(type: ANIME, seasonYear: $year, season: $season) {
                    id,
                    title {
                      romaji
                      english
                    },
                    seasonYear,
                    season
                  }
                }
              }
            `,
            variables: { page: currentPage, perPage: 25, year: currentYear, season: currentSeason }
        })
    });

    const results = await response.json();

    if (!results || results.errors) {
      logger.scripts.error("An error (or multiple errors) occurred!\n", results ? results.errors : "No response was returned.");
      break;
    }

    if (results?.data?.Page?.media?.length > 0) animes = animes.concat(results.data.Page.media);
    else break;
  }

  return animes;
}

async function populateDatabase(): Promise<number> {
  const seasonAnimes: AnimeObject[] = await queryAniListForSeason();

  const animeDocuments = seasonAnimes.map(anime => {
    let title;
    let extraTitles;
    if (anime.title.english) {
      title = anime.title.english;
      extraTitles = anime.title.romaji.trim() !== anime.title.english.trim() ? [anime.title.romaji] : [];
    } else title = anime.title.romaji;

    return new Anime({
      anilistId: anime.id,
      title,
      extraTitles,
      year: anime.seasonYear,
      season: Season[anime.season]
    });
  });

  const bulk = Anime.collection.initializeUnorderedBulkOp();
  animeDocuments.forEach(aD => bulk.insert(aD));
  const bulkResult = await bulk.execute();

  return bulkResult && bulkResult.insertedCount ? bulkResult.insertedCount : 0;
}

Database.connect().then(async function startPopulating() {
  const insertedCount = await populateDatabase();
  logger.scripts.info(`Populate import script successfully completed. Imported ${insertedCount} animes for ${currentSeason} ${currentYear}.`);

  return process.exit();
});
