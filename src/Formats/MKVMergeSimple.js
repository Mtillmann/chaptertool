import {FormatBase} from "./FormatBase.js";
import {secondsToTimestamp, timestampToSeconds, zeroPad} from "../util.js";

export class MKVMergeSimple extends FormatBase {

    filename = 'mkvmerge-chapters.txt';
    mimeType = 'text/plain';

    detect(inputString) {
        return /^CHAPTER01/.test(inputString.trim());
    }

    parse(string) {
        if(!this.detect(string)){
            throw new Error('File must start with CHAPTER01')
        }

        const lines = string.split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());

        let chapters = [];
        lines.forEach(line => {
            const match = /^CHAPTER(?<index>\d+)(?<key>NAME)?=(?<value>.*)/.exec(line);
            const index = parseInt(match.groups.index) - 1;
            const key = match.groups.key === 'NAME' ? 'title' : 'startTime';
            const value = key === 'startTime' ? timestampToSeconds(match.groups.value) : match.groups.value;

            if (chapters[index]) {
                chapters[index][key] = value;
            } else {
                chapters[index] = {[key]: value};
            }

        });

        this.chapters = chapters;
    }

    toString() {
        return this.chapters.map((chapter, index) => {
            const i = zeroPad(index + 1, 2);
            const options = {
                hours: true,
                milliseconds: true
            };
            let output = [
                `CHAPTER${i}=${secondsToTimestamp(chapter.startTime, options)}`
            ];
            if (chapter.title?.trim().length > 0) {
                output.push(`CHAPTER${i}NAME=${chapter.title}`);
            }
            return output.join("\n");
        }).join("\n");
    }
}