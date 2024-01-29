import { secondsToTimestamp, timestampToSeconds } from "../util.js";
import { FormatBase } from "./FormatBase.js";

export class ShutterEDL extends FormatBase {

    detect(inputString) {
        return /^TITLE:\s.*\r?\n/.test(inputString.trim());
    }

    decodeTime(timeString) {
        return timeString.replace(/:(\d+)$/,'.$1');
    }

    encodeTime(time) {
        const string = secondsToTimestamp(time, {milliseconds: true});
        //todo handle ms better here... 
        return string.replace(/\.(\d+)$/,':$1');
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
                
                acc.push({
                    startTime,
                    endTime,
                    title
                });
                return acc;
            }, []);
    }

    /*
    TITLE: bunny-dings
000001  BigBuckBunny_320x180.mp4 V     C        00:00:00:00 00:00:11:21 00:00:00:00 00:00:11:21
000002  BigBuckBunny_320x180.mp4 A     C        00:00:00:00 00:00:11:21 00:00:00:00 00:00:11:21
000003  BigBuckBunny_320x180.mp4 A2    C        00:00:00:00 00:00:11:21 00:00:00:00 00:00:11:21
000004  BigBuckBunny_320x180_cut.mp4 V     C        00:00:11:21 00:00:15:18 00:00:11:21 00:00:15:18
000005  BigBuckBunny_320x180_cut.mp4 A     C        00:00:11:21 00:00:15:18 00:00:11:21 00:00:15:18
000006  BigBuckBunny_320x180_cut.mp4 A2    C        00:00:11:21 00:00:15:18 00:00:11:21 00:00:15:18
000007  BigBuckBunny_320x180.mp4 V     C        00:00:15:18 00:00:23:01 00:00:15:18 00:00:23:01
000008  BigBuckBunny_320x180.mp4 A     C        00:00:15:18 00:00:23:01 00:00:15:18 00:00:23:01
000009  BigBuckBunny_320x180.mp4 A2    C        00:00:15:18 00:00:23:01 00:00:15:18 00:00:23:01
000010  BigBuckBunny_320x180_cut.mp4 V     C        00:00:23:01 00:00:47:17 00:00:23:01 00:00:47:17
000011  BigBuckBunny_320x180_cut.mp4 A     C        00:00:23:01 00:00:47:17 00:00:23:01 00:00:47:17
000012  BigBuckBunny_320x180_cut.mp4 A2    C        00:00:23:01 00:00:47:17 00:00:23:01 00:00:47:17
000013  BigBuckBunny_320x180.mp4 V     C        00:00:47:17 00:00:56:02 00:00:47:17 00:00:56:02
*/

    toString() {
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