import { FormatBase } from "./FormatBase.js";
import { secondsToTimestamp, timestampToSeconds } from "../util.js";

export class MP4Chaps extends FormatBase {

    filename = 'mp4chaps.txt';
    mimeType = 'text/plain';

    detect(inputString) {
        return /^\d\d:\d\d:\d\d.\d\d?\d?\s/.test(inputString.trim());
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('MP4Chaps *MUST* begin with 00:00:00, received: ' + string.substr(0, 10) + '...');
        }
        this.chapters = this.stringToLines(string).map(line => {
            line = line.split(' ');
            const startTime = timestampToSeconds(line.shift(line));
            const [title, href] = line.join(' ').split('<');
            const chapter = {
                startTime,
                title : title.trim()
            }

            if(href){
                chapter.href = href.replace('>', '');
            }

            return chapter;
        });
    }

    toString(){
        return this.chapters.map((chapter) => {
            const line = [];
            line.push(secondsToTimestamp(chapter.startTime, {milliseconds: true}));
            line.push(chapter.title);
            if(chapter.href){
                line.push(`<${chapter.href}>`);
            }
            return line.join(' ');
        }).join("\n");
    }

}