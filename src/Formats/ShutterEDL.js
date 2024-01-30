import { secondsToTimestamp, timestampToSeconds } from "../util.js";
import { FormatBase } from "./FormatBase.js";

export class ShutterEDL extends FormatBase {

    // this format is based on the shutter encoder edl format
    // https://github.com/paulpacifico/shutter-encoder/blob/f3d6bb6dfcd629861a0b0a50113bf4b062e1ba17/src/application/SceneDetection.java

    detect(inputString) {
        return /^TITLE:\s.*\r?\n/.test(inputString.trim());
    }

    decodeTime(timeString) {
        return timeString.replace(/:(\d+)$/,'.$10');
    }

    encodeTime(time) {
        // since this format apparently expects the end time of the next item and the previous start time
        // to be the same, 
        // I'll round them to look like they looked in my sample file when converting
        // from shutter edl to shutter edl...

        const string = secondsToTimestamp(time, {milliseconds: true});
        const ms = String(Math.ceil(parseInt(string.split('.').pop()) * 0.1));
        return string.replace(/\.(\d+)$/,`:${ms.padStart(2, '0')}`);
    }

    parse(input) {
        if (!this.detect(input)) {
            throw new Error('input must start with TITLE:')
        }

        const titleMatch = input.match(/^TITLE:\s(.*)\r?\n/);
        this.meta.title = titleMatch?.[1] ?? 'Chapters';

        this.chapters = Array.from(input.matchAll(/(?<index>\d{6})\s+(?<title>[^\s]+)\s+\w+\s+\w+\s+(?<startTime>\d\d:\d\d:\d\d:\d\d)\s+(?<endTime>\d\d:\d\d:\d\d:\d\d)/g))
            .reduce((acc, match) => {
                const startTime = timestampToSeconds(this.decodeTime(match.groups.startTime));
                const endTime = timestampToSeconds(this.decodeTime(match.groups.endTime));
                const title = match.groups.title;

                if (acc.at(-1)?.startTime === startTime) {
                    return acc;
                }

                console.log(startTime, endTime, title);
                
                acc.push({
                    startTime,
                    endTime,
                    title
                });
                return acc;
            }, []);
    }

    toString() {
        // this format is weird, it expects 3 tracks per chapter, i suspect it's
        // V = video, A, A2 = stereo audio
        const tracks = ['V', 'A', 'A2'];
        const output = this.chapters.reduce((acc, chapter,i) => {
            
            const index = i * 3 + 1;
            const startTime = this.encodeTime(chapter.startTime);
            const endTime = this.encodeTime(chapter.endTime);
            for(let j = 0; j < 3; j++){
                acc.push(`${(j + index).toString().padStart(6, '0')} ${chapter.title} ${tracks[j]}${" ".repeat(6 - tracks[j].length)}C        ${startTime} ${endTime} ${startTime} ${endTime}`);
            }
            
            return acc;
        }, []);
        
        output.unshift('TITLE: ' + this.meta.title);
        return output.join("\n");
    }
}