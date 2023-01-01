import express from 'express';

export class Server {
    options = null;

    constructor(options) {
        this.options = options;


        const app = express();
        const port = options.port;

        app.set('view engine', 'pug')
        app.set('views', 'src/views');
        app.use(express.static('static'));


        app.locals.pretty = true;
        app.get('/', (req, res) => {

            res.render('index')
        });

        app.listen(port, () => {
            let folder = '';
            if (this.options['@action'] === 'generate') {

                console.log('...')
            } else if (this.options['@action'] === 'serve' && 'input' in this.options) {
                folder = '?folder='+encodeURIComponent(this.options.input);
            }

            console.log(`open http://localhost:${port}${folder} in your browser`)
        })

    }
}