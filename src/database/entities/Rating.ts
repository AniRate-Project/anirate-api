import { getModelForClass, prop } from "@typegoose/typegoose";

export class Rating {
    @prop()
    user: string;

    @prop()
    score: number;

    @prop()
    date: Date;
}