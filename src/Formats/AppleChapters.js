import jsdom from "jsdom";
import { secondsToTimestamp, timestampToSeconds } from "../util.js";
import { MatroskaXML } from "./MatroskaXML.js";


export class AppleChapters extends MatroskaXML {

    supportsPrettyPrint = true;
    filename = 'apple-chapters.xml';
    mimeType = 'text/xml';


    detect(inputString) {
        return /^<\?xml/.test(inputString.trim()) && /<TextStream/.test(inputString);
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('Input needs xml declaration and a <TextStream...> node');
        }

        let dom;
        if (typeof DOMParser !== 'undefined') {
            dom = (new DOMParser()).parseFromString(string, 'application/xml');
        } else {
            const {JSDOM} = jsdom;
            dom = new JSDOM(string, {contentType: 'application/xml'});
            dom = dom.window.document;
        }

        this.chapters = [...dom.querySelectorAll('TextSample')].map(chapter => {
            const title = chapter.getAttribute('text') ?? chapter.textContent;
            return {
                title,
                startTime: timestampToSeconds(chapter.getAttribute('sampleTime')),
            };
        });
    }

    toString(pretty = false, exportOptions = {}) {
        const indent = (depth, string, spacesPerDepth = 2) => (pretty ? ' '.repeat(depth * spacesPerDepth) : '') + string;

        let output = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<TextStream version="1.1">',
            indent(1, '<TextStreamHeader>'),
            indent(2, '<TextSampleDescription>'),
            indent(2, '</TextSampleDescription>'),
            indent(1, '</TextStreamHeader>')
        ];

        this.chapters.forEach(chapter => {
            
            const attrContent = exportOptions.acUseTextAttr && chapter.title ? ` text="${chapter.title}"` :'';
            const content = !exportOptions.acUseTextAttr && chapter.title ? chapter.title :'';

            output.push(indent(3, `<TextSample sampleTime="${secondsToTimestamp(chapter.startTime, {milliseconds: true})}"${attrContent}>${content}</TextSample>`));
        });

        output.push(
            '</TextStream>'
        );

        return output.join(pretty ? "\n" : '');
    }
}