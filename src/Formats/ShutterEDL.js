import { timestampToSeconds } from "../util.js";
import { FormatBase } from "./FormatBase.js";

export class ShutterEDL extends FormatBase {

    detect(inputString) {
        return /^TITLE:\s.*\r?\n/.test(inputString.trim());
    }

    decodeTime(timeString) {
        return timeString.replace(/:(\d+)$/,'.$1');
    }

    encodeTime(time) {
        const frames = Math.floor(time / 1000 * 24);
        const seconds = Math.floor(frames / 24);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}:${minutes % 60}:${seconds % 60}:${frames % 24}`;
    }

    parse(input) {
        if (!this.detect(input)) {
            throw new Error('input must start with TITLE:')
        }

        const titleMatch = input.match(/^TITLE:\s(.*)\r?\n/);
        this.title = titleMatch?.[1] ?? 'Chapters';

        this.chapters = Array.from(input.matchAll(/(?<index>\d{6})\s+(?<title>[^\s]+)\s+\w+\s+\w+\s+(?<startTime>\d\d:\d\d:\d\d:\d\d)\s+(?<endTime>\d\d:\d\d:\d\d:\d\d)/g))
            .reduce((acc, match) => {
                if (acc.at(-1)?.startTime === match.groups.startTime) {
                    return acc;
                }

                const startTime = timestampToSeconds(this.decodeTime(match.groups.startTime));
                const endTime = timestampToSeconds(this.decodeTime(match.groups.endTime));
                const title = match.groups.title;

                acc.push({
                    startTime,
                    endTime,
                    title
                });
                return acc;
            }, []);
    }


    toString() {
         
    }
}