import {FormatBase} from "./FormatBase.js";
import {secondsToTimestamp, timestampToSeconds} from "../util.js";

export class PySceneDetect extends FormatBase {
    detect(inputString) {
        return ['Scene Number', 'Timecode Lis'].includes(inputString.trim().slice(0, 12));
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('File must start with "Scene Number" or "Timecode List"')
        }

        const lines = string.split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());

        if (/^Timecode/.test(lines[0])) {
            lines.shift()
        }
        lines.shift();

        this.chapters = lines.map(line => {
            const cols = line.split(',');

            return {
                startTime: timestampToSeconds(cols[2]),
                endTime: timestampToSeconds(cols[5])
            }
        })


    }

    toString(pretty = 'ignored', exportOptions = {}) {

        const framerate = exportOptions.psdFramerate || 23.976;
        const omitTimecodes = !!exportOptions.psdOmitTimecodes;

        let lines = this.chapters.map((chapter, index) => {

            const next = this.chapters[index + 1];
            const endTime = next?.startTime || this.duration;
            //use next chapter's start time for maximum native PySceneDetect compatibility
            const l = endTime - chapter.startTime;

            return [
                index + 1,//Scene Number
                Math.round(chapter.startTime * framerate) + 1,//Start Frame
                secondsToTimestamp(chapter.startTime, {hours: true, milliseconds: true}),// Start Timecode
                parseInt(chapter.startTime * 1000),// Start Time (seconds)
                Math.round(endTime * framerate),// End Frame
                secondsToTimestamp(endTime, {hours: true, milliseconds: true}),// End Timecode
                parseInt(endTime * 1000),// End Time (seconds)
                Math.round((endTime - chapter.startTime) * framerate),// Length (frames)
                secondsToTimestamp(l, {hours: true, milliseconds: true}),// Length (timecode)
                parseInt(Math.ceil(l * 1000))// Length (seconds)
            ]

        });


        const tl = 'Timecode List:' + lines.slice(1).map(l => l[2]).join(',')
        lines = lines.map(l => l.join(','));

        lines.unshift('Scene Number,Start Frame,Start Timecode,Start Time (seconds),End Frame,End Timecode,End Time (seconds),Length (frames),Length (timecode),Length (seconds)')

        if(!omitTimecodes){
            lines.unshift(tl);
        }

        return lines.join("\n");
    }
}