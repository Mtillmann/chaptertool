import { TextEncoder, TextDecoder } from "util";
import pkg from 'jest-environment-jsdom';
const { default: $JSDOMEnvironment } = pkg;
export default class JSDOMEnvironment extends $JSDOMEnvironment {
    constructor(...args) {
        const { global } = super(...args);
        if (!global.TextEncoder)
            global.TextEncoder = TextEncoder;
        if (!global.TextDecoder)
            global.TextDecoder = TextDecoder;
    }
}