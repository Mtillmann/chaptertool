import { ChaptersJson } from "../src/Formats/ChaptersJson.js";
import { WebVTT } from "../src/Formats/WebVTT.js";
import { Youtube } from "../src/Formats/Youtube.js";
import { FFMetadata } from "../src/Formats/FFMetadata.js";
import { MatroskaXML } from "../src/Formats/MatroskaXML.js";
import { MKVMergeXML } from "../src/Formats/MKVMergeXML.js";
import { MKVMergeSimple } from "../src/Formats/MKVMergeSimple.js";
import { readFileSync } from "fs";
import { sep } from "path";
import { FFMpegInfo } from "../src/Formats/FFMpegInfo.js";
import { AutoFormat } from "../src/Formats/AutoFormat.js";
import { AppleChapters } from "../src/Formats/AppleChapters.js";
import { MP4Chaps } from "../src/Formats/MP4Chaps.js";
import { PodloveSimpleChapters } from "../src/Formats/PodloveSimpleChapters.js";
import { PySceneDetect } from "../src/Formats/PySceneDetect.js";
import { ShutterEDL } from "../src/Formats/ShutterEDL.js";
import { VorbisComment } from "../src/Formats/VorbisComment.js";

describe('autodetection of sample files', () => {


    const filesAndKeysAndHandlers = [
        ['applechapters.xml', 'applechapters', AppleChapters],
        ['chapters.json', 'chaptersjson', ChaptersJson],
        ['FFMetadata.txt', 'ffmetadata', FFMetadata],
        ['ffmpeginfo.txt', 'ffmpeginfo', FFMpegInfo],
        ['matroska.xml', 'matroskaxml', MatroskaXML],
        ['mkvmerge.simple.txt', 'mkvmergesimple', MKVMergeSimple],
        ['mkvmerge.xml', 'mkvmergexml', MKVMergeXML],
        ['mp4chaps.txt', 'mp4chaps', MP4Chaps],
        ['podlove-simple-chapters.xml', 'psc', PodloveSimpleChapters],
        ['pyscenedetect.csv', 'pyscenedetect', PySceneDetect],
        ['shutter.edl', 'shutteredl', ShutterEDL],
        ['vorbiscomment.txt', 'vorbiscomment', VorbisComment],
        ['webvtt.txt', 'webvtt', WebVTT],
        ['youtube-chapters.txt', 'youtube', Youtube],

    ];

    filesAndKeysAndHandlers.forEach(item => {
        const [file, key, className] = item;
        const content = readFileSync(module.path + sep + 'samples' + sep + file, 'utf-8');

        it(`${className.name} parses ${file}`, () => {
            expect(() => {
                new className(content)
            }).not.toThrow(Error);
        });

        it(`detects ${file} and yields correct instance`, () => {
            expect(AutoFormat.from(content)).toBeInstanceOf(className);
        });

        it(`detects ${file} and yields correct class`, () => {
            expect(AutoFormat.detect(content, 'class')).toBe(className);
        });


        it(`detects ${file} and yields correct key`, () => {
            expect(AutoFormat.detect(content, 'key')).toBe(key);
        });

        filesAndKeysAndHandlers.forEach(item => {
            const [file2, key2, className2] = item;
            if (className2 === className) {
                return;
            }

            it(`${className2.name} rejects ${file}`, () => {
                expect(() => {
                    new className2(content)
                }).toThrow(Error);
            });
        })

    });


    return;
    /*
    Object.entries(filesAndHAndlers).forEach(pair => {
        const [file, className] = pair;
        const content = readFileSync(module.path + sep + 'samples' + sep + file, 'utf-8');
        it(`${className.name} detects ${file}`, () => {
            expect(() => {
                new className(content)
            }).not.toThrow(Error);
        });

        Object.entries(filesAndHAndlers).forEach(pair => {
            const className2 = pair[1];
            if (className2 === className) {
                return;
            }

            it(`${className2.name} rejects ${file}`, () => {
                expect(() => {
                    new className2(content)
                }).toThrow(Error);
            });
        })
    });


     */
});