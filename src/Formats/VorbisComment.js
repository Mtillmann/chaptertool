import { MKVMergeSimple } from "./MKVMergeSimple.js";

export class VorbisComment extends MKVMergeSimple {

    filename = 'vorbis-comment.txt';
    mimeType = 'text/plain';
    

    constructor(input = null, extraProperties = {}) {
        super(input, {...extraProperties, zeroPad: 3});
    }
}