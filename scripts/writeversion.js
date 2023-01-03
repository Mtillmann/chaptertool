import pckg from "../package.json" assert {type: 'json'};
import {dirname, resolve, sep} from 'path';
import {writeFileSync} from "fs";

const dir = dirname(process.argv[1]);
writeFileSync(resolve(`${dir}${sep}..${sep}static${sep}version`), pckg.version);