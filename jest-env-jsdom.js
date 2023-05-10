import { TextEncoder, TextDecoder } from "util";
import jejsdom from 'jest-environment-jsdom';
const { default: $JSDOMEnvironment, TestEnvironment: te } = jejsdom;

class JSDOMEnvironment extends $JSDOMEnvironment {
    constructor(...args) {
        const { global } = super(...args);
        if (!global.TextEncoder)
            global.TextEncoder = TextEncoder;
        if (!global.TextDecoder)
            global.TextDecoder = TextDecoder;
    }
}

export default JSDOMEnvironment;
export const TestEnvironment = te === $JSDOMEnvironment ? JSDOMEnvironment : te;