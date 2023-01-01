import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";

export default {
    input: 'src/Frontend.js',
    output: {
        file: 'static/app.js',
        format: 'umd'
    },
    plugins: [
        nodeResolve(),
        copy({
            targets: [
                { src: 'node_modules/bootstrap-icons/font/fonts', dest: 'static' }
            ]
        }),
        replace({ //this.fixes the annoying popper bug
            'process.env.NODE_ENV': JSON.stringify('production')
        })
    ]
};