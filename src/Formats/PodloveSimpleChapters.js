import { FormatBase } from "./FormatBase.js";
import jsdom from "jsdom";
import { NPTToSeconds, secondsToNPT } from "../util.js";

export class PodloveSimpleChapters extends FormatBase {

    supportsPrettyPrint = true;
    filename = 'podlove-simple-chapters-fragment.xml';
    mimeType = 'text/xml';

    detect(inputString) {

        return /<psc:chapters/.test(inputString);
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('Input must contain <psc:chapters ...> node');
        }

        let dom;
        if (typeof DOMParser !== 'undefined') {
            dom = (new DOMParser()).parseFromString(string, 'application/xml');
        } else {
            const { JSDOM } = jsdom;
            dom = new JSDOM(string, { contentType: 'application/xml' });
            dom = dom.window.document;
        }


        this.chapters = [...dom.querySelectorAll('[start]')].reduce((acc, node) => {

            if (node.tagName === 'psc:chapter') {
                const start = node.getAttribute('start');
                const title = node.getAttribute('title');
                const image = node.getAttribute('image');
                const href = node.getAttribute('href');

                const chapter = {
                    startTime: NPTToSeconds(start)
                }

                if (title) {
                    chapter.title = title;
                }
                if (image) {
                    chapter.img = image;
                }
                if (href) {
                    //is this ever used, except for this format?
                    chapter.href = href;
                }

                acc.push(chapter);
            }
            return acc;

        }, []);

    }

    toString(pretty = false) {
        const indent = (depth, string, spacesPerDepth = 2) => (pretty ? ' '.repeat(depth * spacesPerDepth) : '') + string;

        let output = [
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
            indent(1, '<channel>'),
            indent(2, '<!-- this is only a fragment of an rss feed, see -->'),
            indent(2, '<!-- https://podlove.org/simple-chapters/#:~:text=37%20seconds-,Embedding%20Example,-This%20is%20an -->'),
            indent(2, '<!-- for more information -->'),
            indent(2, '<psc:chapters version="1.2" xmlns:psc="http://podlove.org/simple-chapters">'),
        ];

        this.chapters.forEach(chapter => {

            const node = [
                `<psc:chapter start="${secondsToNPT(chapter.startTime)}"`,
            ];

            if (chapter.title) {
                node.push(` title="${chapter.title}"`);
            }
            if (chapter.img) {
                node.push(` image="${chapter.img}"`);
            }
            if (chapter.href) {
                node.push(` href="${chapter.href}"`);
            }
            node.push('/>');

            output.push(indent(3, node.join('')));

        });

        output.push(
            indent(2, '</psc:chapters>'),
            indent(1, '</channel>'),
            indent(0, '</rss>')
        );

        return output.join(pretty ? "\n" : '');
    }
}