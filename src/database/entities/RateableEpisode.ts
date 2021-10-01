import { prop } from "@typegoose/typegoose";

import { Rating } from "./Rating";

export class RateableEpisode {
    @prop()
    episode!: string;

    @prop({ type: () => [Rating] })
    ratings: Rating[];
}
