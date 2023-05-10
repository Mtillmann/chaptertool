import {FormatBase} from "./FormatBase.js";
import {enforceMilliseconds} from "../util.js";

export class FFMpegInfo extends FormatBase {


    detect(inputString) {
        return /^frame:\d/.test(inputString.trim());
    }

    parse(input) {
        if (!this.detect(input)) {
            throw new Error('input must start with frame:')
        }

        const matches = Array.from(input.matchAll(/frame:(\d+).*pts_time:([\d.]+)\r?\n/g));
        this.chapters = matches.map(match => {
            const startTime = enforceMilliseconds(parseFloat(match[2]));
            return {
                startTime
            };
        });

        this.rebuildChapterTitles();
    }


    toString() {
        throw new Error(`this class won't generate actual output`)
    }
}