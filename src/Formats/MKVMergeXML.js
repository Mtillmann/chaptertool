import { MatroskaXML } from "./MatroskaXML.js";
import { secondsToTimestamp, timestampToSeconds } from "../util.js";

export class MKVMergeXML extends MatroskaXML {

    supportsPrettyPrint = true;
    filename = 'mkvmerge-chapters.xml';
    mimeType = 'text/xml';

    constructor(input) {
        super(input, {
            chapterStringNodeName: 'ChapterString',
            inputTimeToSeconds: string => timestampToSeconds(string),
            secondsToOutputTime: seconds => secondsToTimestamp(seconds, { hours: true, milliseconds: true })
        });
    }
}