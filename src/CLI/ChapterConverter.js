import {lstatSync, readFileSync, writeFileSync} from "fs";
import {AutoFormat} from "../Formats/AutoFormat.js";

export class ChapterConverter {

    constructor(options) {
        const inputStats = lstatSync(options.input);
        if (inputStats.size > 1e6) {
            throw new Error('input filesize exceeds 1Mb');
        }

        const chapters = AutoFormat.from(readFileSync(options.input, 'utf-8'));
        if (options.imgUri) {
            chapters.applyImgUri(options.imgUri);
        }

        if (options.outputFile) {
            writeFileSync(options.outputFile, AutoFormat.as(options.outputFormat, chapters).toString(options.pretty, {
                imagePrefix: options.imgUri,
                writeEndTimes: !options.noEndTimes,
                psdFrameRate: options.psdFrameRate,
                psdOmitTimecodes : options.psdOmitTimecodes
            }));
            return;
        }

        console.log(AutoFormat.as(options.outputFormat, chapters).toString(options.pretty, {
            imagePrefix: options.imgUri,
            writeEndTimes: !options.noEndTimes
        }));
    }
}