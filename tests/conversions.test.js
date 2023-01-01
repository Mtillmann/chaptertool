import {ChaptersJson} from "../src/Formats/ChaptersJson.js";
import {WebVTT} from "../src/Formats/WebVTT.js";
import {Youtube} from "../src/Formats/Youtube.js";
import {FFMetadata} from "../src/Formats/FFMetadata.js";
import {MatroskaXML} from "../src/Formats/MatroskaXML.js";
import {MKVMergeXML} from "../src/Formats/MKVMergeXML.js";
import {MKVMergeSimple} from "../src/Formats/MKVMergeSimple.js";
import {readFileSync} from "fs";
import {sep} from "path";

describe('conversions from one format to any other', () => {
    const formats = [ChaptersJson, WebVTT, Youtube, FFMetadata, MatroskaXML, MKVMergeXML, MKVMergeSimple];

    const content = readFileSync(module.path + sep + 'samples' + sep + 'chapters.json', 'utf-8');

    const initial = new ChaptersJson(content);

    formats.forEach(fromFormat => {
        const from = initial.to(fromFormat);
        formats.forEach(toFormat => {
                const to = from.to(toFormat);
            it(`yields equal chapter count from ${fromFormat.name} to ${toFormat.name}`, () => {
                expect(from.chapters.length).toEqual(to.chapters.length);
            })

            it(`has same startTimes from ${fromFormat.name} to ${toFormat.name}`, () => {
                expect(from.chapters[0].startTime_hr).toEqual(to.chapters[0].startTime_hr);
            })
        })
    })

});