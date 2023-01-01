import pug from 'pug';
import {dirname, resolve, sep} from 'path';
import {writeFileSync} from "fs";

const dir = dirname(process.argv[1]);

writeFileSync(resolve(`${dir}${sep}..${sep}static${sep}index.html`), pug.renderFile(resolve(`${dir}${sep}..${sep}src${sep}views${sep}index.pug`)));

