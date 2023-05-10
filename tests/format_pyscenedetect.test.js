import {PySceneDetect} from "../src/Formats/PySceneDetect.js";
import {readFileSync} from "fs";
import {sep} from "path";
import {MKVMergeXML} from "../src/Formats/MKVMergeXML.js";

describe('PySceneDetect Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new PySceneDetect();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new PySceneDetect('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'pyscenedetect.csv', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new PySceneDetect(content);
        }).not.toThrow(Error);
    });

    const instance = new PySceneDetect(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(20);
    });
    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[0].endTime.toFixed(3)).toBe(4.921 .toFixed(3))
    });


    it('exports to correct format',() => {
        expect(instance.toString().slice(0,13)).toEqual('Timecode List');
    });

    it('exports to correct format without timecodes',() => {
        expect(instance.toString(false, {psdOmitTimecodes : true}).slice(0,12)).toEqual('Scene Number');
    });

    it('respects framerate option',() => {
        expect(instance.toString(false, {psdFramerate : 60})).toContain('2806');
    });


    it('export includes correct timestamp',() => {
        expect(instance.toString()).toContain('00:00:40.123');
    });

    it('can import previously generated export',() => {
        expect(new PySceneDetect(instance.toString()).chapters[3].startTime).toEqual(18.560);
    });

    it('can convert into other format', () => {
        expect(instance.to(MKVMergeXML)).toBeInstanceOf(MKVMergeXML)
    });

});
