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
        expect(instance.chapters.length).toEqual(5);
    });

    it('has the correct title from content', () => {
        expect(instance.meta.title).toEqual('this is the title :D');
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[0].startTime).toBe(6.202)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Chapter 1 of 26')
    });

    it('exports to correct format',() => {
        expect(instance.toString().slice(0,6)).toEqual('WEBVTT');
    });

    it('export includes correct timestamp',() => {
        expect(instance.toString()).toContain('00:03:51.001');
    });

    it('can import previously generated export',() => {
        expect(new PySceneDetect(instance.toString()).chapters[3].endTime).toEqual(542.001);
    });

    it('can convert into other format', () => {
        expect(instance.to(MKVMergeXML)).toBeInstanceOf(MKVMergeXML)
    });

});
