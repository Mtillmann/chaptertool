import {readFileSync} from "fs";
import {sep} from "path";
import {FFMpegInfo} from "../src/Formats/FFMpegInfo.js";

describe('enforces minimum chapter time', () => {
    const content = readFileSync(module.path + sep + 'samples' + sep + 'ffmpeginfo.txt', 'utf-8');


    it('has correct number of chapters on construct', () => {
        const instance = new FFMpegInfo(content);
        expect(instance.chapters.length).toEqual(71);
    });

    [[10, 57], [30, 45], [120, 21]].forEach(pair => {
        const [seconds, expected] = pair;
        it(`filters out chapters below ${seconds} sec`, () => {
            const instance = new FFMpegInfo(content);
            instance.applyChapterMinLength(seconds);
            expect(instance.chapters.length).toEqual(expected)
        });

        it(`yields a map of deleted chapters with correct length for ${seconds} sec`, () => {
            const instance = new FFMpegInfo(content);
            const changes = instance.applyChapterMinLength(seconds);
            const l = Object.entries(changes).filter(pair => pair[1] !== 'deleted').length;
            expect(instance.chapters.length).toEqual(l)
        });

        it(`change map points to correct remaining chapter for ${seconds} sec`, () => {
            const instance = new FFMpegInfo(content);
            const changes = instance.applyChapterMinLength(seconds);
            const lastRemaining = Object.entries(changes).filter(pair => pair[1] !== 'deleted').at(-1);

            expect(instance.chapters.at(lastRemaining[1]).title).toMatch((parseInt(lastRemaining[0]) + 1).toString())
        });

        it(`has no chapters longer than ${seconds} sec`, () => {
            const instance = new FFMpegInfo(content);
            instance.applyChapterMinLength(seconds)
            const chaptersShorterThanExpected = instance.chapters.filter(chapter => chapter.duration < seconds);

            chaptersShorterThanExpected.forEach(console.log)

            expect(chaptersShorterThanExpected.length).toEqual(0)
        });

    });

    it(`filters out all chapters when high minimum is given`, () => {
        const instance = new FFMpegInfo(content);
        instance.applyChapterMinLength(36000);
        expect(instance.chapters.length).toEqual(0)
    });

});