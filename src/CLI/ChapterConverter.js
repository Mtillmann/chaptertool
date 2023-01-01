import {lstatSync, readFileSync} from "fs";
import {AutoFormat} from "../Formats/AutoFormat.js";

export class ChapterConverter {

    constructor(options) {
        const inputStats = lstatSync(options.input);
        if (inputStats.size > 1e6) {
            throw new Error('input filesize exceeds 1Mb');
        }

        const chapters = AutoFormat.from(readFileSync(options.input, 'utf-8'));
        if(options.imgUri){
            chapters.chapters.forEach((chapter, i) => {
                if('img' in chapter){
                    chapters.chapters[i].img = options.imgUri.replace(/\/*$/,'')  + '/' + chapter.img.replace(/^\/*/,'');
                }
            });
        }

        console.log(AutoFormat.as(options.outputFormat, chapters).toString(options.pretty));
    }
}