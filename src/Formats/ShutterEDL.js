import { FormatBase } from "./FormatBase.js";
import { enforceMilliseconds } from "../util.js";

export class ShutterEDL extends FormatBase {

    detect(inputString) {
        return /^TITLE:\s.*\r?\n/.test(inputString.trim());
    }

    parse(input) {
        if (!this.detect(input)) {
            throw new Error('input must start with TITLE:')
        }

        const titleMatch = input.match(/^TITLE:\s(.*)\r?\n/);
        this.title = titleMatch?.[1] ?? 'Chapters';

        const timeStamps = Array.from(input.matchAll(/(?<index>\d{6})\s+(?<name>[^\s]+)\s+\w+\s+\w+\s+(?<in>\d\d:\d\d:\d\d:\d\d)\s+(?<out>\d\d:\d\d:\d\d:\d\d)/g));

        console.log(timeStamps);

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