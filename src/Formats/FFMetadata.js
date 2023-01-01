import {enforceMilliseconds, escapeRegExpCharacters} from "../util.js";
import {FormatBase} from "./FormatBase.js";

export class FFMetadata extends FormatBase {

    filename = 'FFMpegdata.txt';
    mimeType = 'text/plain';

    constructor(input) {
        const characters = ["=", ";", "#", "\\", "\n"];
        const safeCharacters = characters.map(char => escapeRegExpCharacters(char)).join('|');
        super(input, {
            unescapeRegexp: new RegExp('\\\\(' + safeCharacters + ')', 'g'),
            escapeRegexp: new RegExp('(' + safeCharacters + ')', 'g')
        });
    }

    detect(inputString) {
        return inputString.trim().slice(0, 12) === ';FFMETADATA1';
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error(';FFMETADATA1 header missing :(');
        }
        const lines = this.stringToLines(string);


        let chapters = [];
        let ignoreAllUntilNextChapter = false;
        let isMultilineTitle = false;

        lines.forEach(line => {
            let [key, value] = line.split('=');
            if (chapters.length === 0 && key === 'title') {
                this.meta.title = this.unescape(value);
                return;
            }


            if (line === '[CHAPTER]') {
                chapters.push({});
                ignoreAllUntilNextChapter = false;
                return;
            }
            if (line.slice(0, 1) === '[') {
                ignoreAllUntilNextChapter = true;
            }
            if (chapters.length === 0 || ignoreAllUntilNextChapter) {
                return;
            }

            if (!/[^\\]=/.test(line) && isMultilineTitle) {
                //should I keep the multilines?!
                chapters[chapters.length - 1].title += ' ' + line;
                return;
            }
            isMultilineTitle = false;

            if (key === 'title') {
                chapters[chapters.length - 1].title = this.unescape(value);
                if (/\\$/.test(value)) {
                    isMultilineTitle = true;
                }
            } else if (key === 'START') {
                chapters[chapters.length - 1].startTime = enforceMilliseconds(parseFloat(value) * 1e-3);
            } else if (key === 'END') {
                chapters[chapters.length - 1].endTime = enforceMilliseconds(parseFloat(value) * 1e-3);
            }
        });

        this.chapters = chapters;
    }

    unescape(string) {
        return string.replace(this.unescapeRegexp, '$1').replace(/\\$/g, '');
    }

    escape(string) {
        return string.replace(this.escapeRegexp, '\\$1')
    }

    toString() {
        let output = [';FFMETADATA1'];
        if (this.meta.title.trim().length > 0) {
            output.push(`title=${this.escape(this.meta.title)}`);
        }
        output.push('');
        this.chapters.forEach(chapter => {
            output.push('[CHAPTER]', 'TIMEBASE=1/1000');
            output.push('START=' + (enforceMilliseconds(chapter.startTime) * 1000))
            output.push('END=' + (enforceMilliseconds(chapter.endTime) * 1000))
            if (chapter.title?.trim().length > 0) {
                output.push(`title=${this.escape(chapter.title)}`);
            }
            output.push('');
        });

        return output.join("\n");
    }
}