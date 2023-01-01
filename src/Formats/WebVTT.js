import {FormatBase} from "./FormatBase.js";
import {secondsToTimestamp, timestampToSeconds} from "../util.js";

export class WebVTT extends FormatBase {

    filename = 'webvtt-chapters.txt';
    mimeType = 'text/plain';

    detect(inputString) {
        return inputString.trim().slice(0, 6) === 'WEBVTT';
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('WEBVTT header missing :(');
        }

        const lines = string.split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());

        const header = lines.shift().split(/\s*-\s*/);


        if (header[1]) {
            this.meta.title = header[1];
        }

        let chapters = [];

        lines.forEach(line => {
            if (/^\d+$/.test(line)) {
                chapters.push({});
                return;
            }

            const index = chapters.length - 1;
            const timestamps = /(.*)\s+-->\s+(.*)/.exec(line);
            if (timestamps && timestamps.length === 3) {
                chapters[index].startTime = timestampToSeconds(timestamps[1]);
                chapters[index].endTime = timestampToSeconds(timestamps[2]);
                return;
            }

            chapters[index].title = line;
        });

        this.chapters = chapters;
    }

    toString() {
        let output = ['WEBVTT'];
        if (this.meta.title.trim().length > 0) {
            output[0] += ' - ' + this.meta.title.trim();
        }
        const options = {hours: true, milliseconds: true};


        this.chapters.forEach((chapter, index) => {
            output.push('');
            output.push(...[
                    index + 1,
                    secondsToTimestamp(chapter.startTime, options) + ' --> ' + secondsToTimestamp(chapter.endTime, options),
                    chapter.title || this.getChapterTitle(index)
                ].filter(line => String(line).trim().length > 0)
            );
        });

        return output.join("\n");
    }
}