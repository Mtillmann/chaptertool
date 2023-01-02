#!/usr/bin/env node
import {ArgumentParser} from "./src/CLI/ArgumentParser.js";
import {ChapterGenerator} from "./src/CLI/ChapterGenerator.js";
import {AudioExtractor} from "./src/CLI/AudioExtractor.js";
import * as dotenv from 'dotenv';
import {Server} from "./src/Server.js";
import {ChapterConverter} from "./src/CLI/ChapterConverter.js";

dotenv.config();

const CLIArgs = new ArgumentParser();

const help = `Chaptertools
available commands:
generate    generate chapters from video file
convert     convert chapter files between different formats
serve       run the web ui
`

switch (CLIArgs.action) {
    case 'generate' :
        new AudioExtractor(CLIArgs.options).extract();
        new ChapterGenerator(CLIArgs.options).generate();
        break;
    case 'convert' :
        new ChapterConverter(CLIArgs.options);
        break;
    case 'serve' :
        new Server(CLIArgs.options);
        break;
    default:
        console.log(help);
        break;
}
