import { getModelForClass, prop, post, index, DocumentType } from "@typegoose/typegoose";
import cachegoose from "recachegoose";

import { RateableEpisode } from "./RateableEpisode";
import { Season } from "./Season";

@index({ anilistId: 1 }, { unique: true })
@post<AnimeClass>('save', function(anime) {
    cachegoose.clearCache(`anime.${anime.id}`);
})
export class AnimeClass {
    @prop()
    public anilistId!: number;

    @prop()
    public title!: string;

    @prop({ type: () => [String] })
    public extraTitles!: string[];

    @prop()
    public year!: number;

    @prop()
    public season!: Season;

    @prop({ type: () => [RateableEpisode] })
    public episodes: RateableEpisode[];

    @prop({ type: () => [String] })
    public followers: string[];
}

export const Anime = getModelForClass(AnimeClass, {
    schemaOptions: {
        collection: 'animes',
    }
});

export type AnimeType = DocumentType<AnimeClass>;