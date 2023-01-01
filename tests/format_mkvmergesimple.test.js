
import {readFileSync} from "fs";
import {sep} from "path";
import {MKVMergeSimple} from "../src/Formats/MKVMergeSimple.js";
import {Youtube} from "../src/Formats/Youtube.js";


describe('MKVMergeSimple Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new MKVMergeSimple();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new MKVMergeSimple('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'mkvmerge.simple.txt', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new MKVMergeSimple(content);
        }).not.toThrow(Error);
    });

    const instance = new MKVMergeSimple(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(5);
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[0].startTime).toBe(6.202)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Chapter 1 of 5')
    });

    it('exports to correct format',() => {
        expect(instance.toString().slice(0,9)).toEqual('CHAPTER01');
    });

    it('export includes correct timestamp',() => {
        expect(instance.toString()).toContain('06:16');
    });

    it('can import previously generated export',() => {
        expect(new MKVMergeSimple(instance.toString()).chapters[3].startTime).toEqual(376.882);
    });

    it('can convert into other format', () => {
        expect(instance.to(Youtube)).toBeInstanceOf(Youtube)
    });

});
