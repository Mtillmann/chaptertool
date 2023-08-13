filename = 'vorbis-comment.txt';
mimeType = 'text/plain';


constructor(input = null, extraProperties = {}) {
    super(input, {...extraProperties, zeroPad: 3});
}