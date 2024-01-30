import { FormatBase } from "./FormatBase.js";
import { secondsToTimestamp, timestampToSeconds } from "../util.js";

export class Youtube extends FormatBase {

    filename = "youtube-chapters.txt";
    mimeType = 'text/plain';

    detect(inputString) {
        return /^0?0:00(:00)?\s/.test(inputString.trim());
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('Youtube Chapters *MUST* begin with (0)0:00(:00), received: ' + string.substr(0, 10) + '...');
        }
        this.chapters = this.stringToLines(string).map(line => {
            line = line.split(' ');
            return {
                startTime: timestampToSeconds(line.shift(line)),
                title: line.join(' ')
            }
        });

    }

    toString() {
        let options = {
            milliseconds: false,
            hours: this.chapters.at(-1).startTime > 3600
        }

        return this.chapters.map((chapter, index) => {
            const startTime = index === 0 && chapter.startTime !== 0 ? 0 : chapter.startTime;
            return `${secondsToTimestamp(startTime, options)} ${chapter.title || 'Chapter' + (index + 1)}`
        }).join("\n");
    }
}