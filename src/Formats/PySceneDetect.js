import {FormatBase} from "./FormatBase.js";
import {timestampToSeconds} from "../util.js";

export class PySceneDetect extends FormatBase {
    detect(inputString) {
        return ['Scene Number', 'Timecode Lis'].includes(inputString.trim().slice(0, 12));
    }

    parse(string) {
        const lines = string.split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());

        if (/^Timecode/.test(lines[0])) {
            lines.shift()
        }

        lines.shift();

        const chapters = [];
        const re = /^\d+,\d+,(?<start>\d+:\d+:\d+\.\d+),[\d.]+,\d+,(?<end>\d+:\d+:\d+\.\d+)/;

        this.chapters = lines.map(line => {
            const cols = line.split(',');
            return {
                startTime : timestampToSeconds(cols[2]),
                endTime : timestampToSeconds(cols[5])
            }
        })



    }

    toString(exportOptions = {}) {
        return 'lol';
    }
}