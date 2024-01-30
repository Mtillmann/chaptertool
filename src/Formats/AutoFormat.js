import { AppleChapters } from "./AppleChapters.js";
import { ChaptersJson } from "./ChaptersJson.js";
import { FFMetadata } from "./FFMetadata.js";
import { FFMpegInfo } from "./FFMpegInfo.js";
import { MKVMergeSimple } from "./MKVMergeSimple.js";
import { MKVMergeXML } from "./MKVMergeXML.js";
import { MatroskaXML } from "./MatroskaXML.js";
import { PySceneDetect } from "./PySceneDetect.js";
import { VorbisComment } from "./VorbisComment.js";
import { WebVTT } from "./WebVTT.js";
import { Youtube } from "./Youtube.js";
import { ShutterEDL } from "./ShutterEDL.js";
import { PodloveSimpleChapters } from "./PodloveSimpleChapters.js";
import { MP4Chaps } from "./MP4Chaps.js";
import { PodloveJson } from "./PodloveJson.js";

export const AutoFormat = {
    classMap: {
        chaptersjson: ChaptersJson,
        ffmetadata: FFMetadata,
        matroskaxml: MatroskaXML,
        mkvmergexml: MKVMergeXML,
        mkvmergesimple: MKVMergeSimple,
        webvtt: WebVTT,
        youtube: Youtube,
        ffmpeginfo: FFMpegInfo,
        pyscenedetect: PySceneDetect,
        vorbiscomment: VorbisComment,
        applechapters: AppleChapters,
        shutteredl: ShutterEDL,
        psc: PodloveSimpleChapters,
        mp4chaps: MP4Chaps,
        podlovejson: PodloveJson
    },

    detect(inputString, returnWhat = 'instance') {
        let detected = false;

        Object.entries(this.classMap)
            .forEach(([key, className]) => {
                if (detected) {
                    return;
                }
                try {
                    detected = new className(inputString);
                    if (detected) {
                        if (returnWhat === 'class') {
                            detected = className;
                        } else if (returnWhat === 'key') {
                            detected = key;
                        }
                    }
                } catch (e) {
                    //console.log(e);
                    //do nothing
                }
            });

        if (!detected) {
            throw new Error('failed to detect type of given input :(')
        }

        

        return detected;
    },

    from(inputString) {
        return this.detect(inputString);
    },

    as(classKeyOrClass, input) {
        if (typeof classKeyOrClass === 'string') {
            if (!(classKeyOrClass in this.classMap)) {
                throw new Error(`invalid class key "${classKeyOrClass}"`);
            }
            return new this.classMap[classKeyOrClass](input);
        }

        return new classKeyOrClass(input);

    }


}
