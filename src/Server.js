import express from 'express';
import {dirname, resolve, sep} from 'path';

export class Server {
    options = null;

    constructor(options) {
        this.options = options;

        const app = express();
        const port = options.port;

        //dir must be set absolute, otherwise npx calls fail to resolve
        const dir = dirname(process.argv[1]);

        app.set('view engine', 'pug')
        app.set('views', dir + '/src/views');
        app.use(express.static(dir + '/static'));
        app.locals.pretty = true;
        app.get('/', (req, res) => {
            res.render('index')
        });

        app.listen(port, () => {
            console.log(`open http://localhost:${port} in your browser`)
        });

    }
}