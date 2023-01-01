import {ChaptersJson} from "../src/Formats/ChaptersJson.js";
import {WebVTT} from "../src/Formats/WebVTT.js";
import {Youtube} from "../src/Formats/Youtube.js";
import {FFMetadata} from "../src/Formats/FFMetadata.js";
import {MatroskaXML} from "../src/Formats/MatroskaXML.js";
import {MKVMergeXML} from "../src/Formats/MKVMergeXML.js";
import {MKVMergeSimple} from "../src/Formats/MKVMergeSimple.js";
import {readFileSync} from "fs";
import {sep} from "path";

describe('detection of input strings', () => {
    const formats = [ChaptersJson, WebVTT, Youtube, FFMetadata, MatroskaXML, MKVMergeXML, MKVMergeSimple];

    const content = readFileSync(module.path + sep + 'samples' + sep + 'chapters.json', 'utf-8');

    const initial = new ChaptersJson(content);

    formats.forEach(fromFormat => {
        const from = initial.to(fromFormat).toString();
        formats.forEach(toFormat => {

            if(toFormat.name === fromFormat.name){
                it(`accepts output of ${fromFormat.name} given to ${toFormat.name}`, () => {
                    expect(() => {
                        new toFormat(from);
                    }).not.toThrow(Error);
                });
            }else{
                it(`fails detection of ${fromFormat.name} output given to ${toFormat.name}`, () => {
                    expect(() => {
                        new toFormat(from);
                    }).toThrow(Error);
                });
            }
        })
    })

});