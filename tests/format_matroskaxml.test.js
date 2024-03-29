
import {readFileSync} from "fs";
import {sep} from "path";
import {MatroskaXML} from "../src/Formats/MatroskaXML.js";
import {MKVMergeSimple} from "../src/Formats/MKVMergeSimple.js";


describe('MatroskaXML Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new MatroskaXML();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new MatroskaXML('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'matroska.xml', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new MatroskaXML(content);
        }).not.toThrow(Error);
    });

    const instance = new MatroskaXML(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(5);
    });


    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[0].startTime).toBe(6.202)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Chapter 1 of 5')
    });

    it('exports to correct format', () => {
        expect(instance.toString().slice(0, 5)).toEqual('<?xml');
    });

    it('export includes correct timestamp', () => {
        expect(instance.toString()).toContain('376882000000');
    });

    it('can import previously generated export', () => {
        expect(new MatroskaXML(instance.toString()).chapters[3].endTime.toFixed(3)).toEqual(542.001 .toFixed(3));
    });

    it('can convert into other format', () => {
        expect(instance.to(MKVMergeSimple)).toBeInstanceOf(MKVMergeSimple)
    });

});
