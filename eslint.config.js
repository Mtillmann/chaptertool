// this assumes that your package.json contains type: module
import neostandard from 'neostandard'

export default neostandard({
  ignores: ['node_modules'],
  files: ['*.js'],
  globals: ['gtag', 'confirm', 'localStorage']
})
