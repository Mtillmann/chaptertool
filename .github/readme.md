![chaptertool](../static/icons/icon-180.png)

# chaptertool

Create and _convert_ chapters for podcasts, youtube, matroska, mkvmerge/nero/vorbis, webvtt, ffmpeginfo, ffmetadata, pyscenedetect, apple chapters, edl, podlove simple chapters (xml, json), apple hls chapters and mp4chaps.

> Build on [@mtillmann/chapters](https://github.com/Mtillmann/chapters)

## [Web App](https://mtillmann.github.io/chaptertool)

[Click here to open the web app](https://mtillmann.github.io/chaptertool).

## Supported Formats

| name | key | ext    | info |
|-------|------|--------|------|
| Podcasting 2.0 Chapters | chaptersjson | `json` | [spec](https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md) |
| FFMetadata | ffmpegdata | `txt`  | [spec](https://ffmpeg.org/ffmpeg-formats.html#Metadata-1) |
| Matroska XML chapters | matroskaxml | `xml`  | [spec](https://www.matroska.org/technical/chapters.html) |
| MKVToolNix mkvmerge XML | mkvmergexml | `xml`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters) |
| MKVToolNix mkvmerge _simple_ | mkvmergesimple | `txt`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters) |
| WebVTT Chapters | webvtt | `vtt`  | [spec](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API) |
| Youtube Chapter Syntax | youtube | `txt`  |  |
| FFMpegInfo | ffmpeginfo | `txt`  | read only, used internally |
| PySceneDetect | pyscenedetect | `csv`  | [project home](https://github.com/Breakthrough/PySceneDetect) |
| Vorbis Comment Format | vorbiscomment | `txt`  | [spec](https://wiki.xiph.org/Chapter_Extension) |
| "Apple Chapters" | applechapters | `xml`  | [source](https://github.com/rigaya/NVEnc/blob/master/NVEncC_Options.en.md#--chapter-string:~:text=CHAPTER03NAME%3Dchapter%2D3-,apple%20format,-(should%20be%20in)) |
| Shutter EDL | edl | `edl`  | [source](https://github.com/paulpacifico/shutter-encoder/blob/f3d6bb6dfcd629861a0b0a50113bf4b062e1ba17/src/application/SceneDetection.java) |
| Podlove Simple Chapters | psc | `xml`  | [spec](https://podlove.org/simple-chapters/) |
| Podlove Simple Chapters JSON | podlovejson | `json` | [source](https://github.com/podlove/chapters#:~:text=org/%3E-,Encode%20to%20JSON,-iex%3E%20Chapters) |
| MP4Chaps | mp4chaps | `txt`  | [source](https://github.com/podlove/chapters#:~:text=%3Achapters%3E-,Encode%20to%20mp4chaps,-iex%3E%20Chapters) |
| Apple HLS Chapters | applehls | `json` | [spec](https://developer.apple.com/documentation/http-live-streaming/providing-javascript-object-notation-json-chapters), partial support |
| SceneCut | scenecut | `json` | [spec](https://github.com/slhck/scenecut-extractor#:~:text=cuts%20in%20JSON-,format,-%3A) |

## CLI 

## Prerequisite

You need to install `node` and optionally `ffmpeg` on your system:

Windows: [modern terminal](https://github.com/microsoft/terminal), [package manager](https://chocolatey.org/), [node](https://www.startpage.com/sp/search?q=windows%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=windows%20install%20ffmpeg)   
macOS: [package manager](https://brew.sh/), [node](https://www.startpage.com/sp/search?q=macOS%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=macOS%20install%20ffmpeg)    
linux: [node](https://www.startpage.com/sp/search?q=linux%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=linux%20install%20ffmpeg)

## create chapters from video

```shell
npx chaptertool@latest generate YOUR_FILE.mp4
```
Wait for the process to finish, afterwards a new folder called `YOUR_FILE_chapters` should be present.
It contains the screenshots from the video and a `chapters.json`-file that contains the automatically generated chapters.

## commands

> `npx chaptertool@latest <command> <input?> --option-a --option-b=value`

### `serve`
Run the http-server that hosts the web ui.

| option    | description                                                                | default |
|-----------|----------------------------------------------------------------------------|---------|
| `--port`  | port for the http-server                                                   | `8989`  |

### `generate`
Generate raw chapters from video using ffmpeg.

| option                 | description                                                                                                                                                                         | default                      |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------|
| `<input>`              | the video file that you want to process                                                                                                                                             |                              |
| `--y`                  | when set ffmpeg will _always_ overwrite existing output                                                                                                                             |                              |
| `--n`                  | when set ffmpeg will _never_ overwrite existing output                                                                                                                              |                              |
| `--output-format`      | output format for the chapters, [see below](#convert)                                                                                                                               | `chaptersjson`               | 
| `--output-folder`      | image destination folder, `$filename` will be replaced with the input video filename minus the extension                                                                            | `$filename_chapters`         |
| `--chapter-template`   | template string for the chapter names.                                                                                                                                              | `Chapter $chapter of $total` |
| `--scene-value`        | min value for ffmpeg's scene detection. If you only use a small portion of the screen, the value should be smaller. See the crop option                                             | `0.1`                        |
| `--scale`              | when given, images will be scaled to given width while keeping original aspect ratio                                                                                                |                              |
| `--force-dar`          | when used, the display aspect ratio will be used for generated images. Useful for some videos. overwrites `--scale`                                                                 |                              |
| `--crop`               | when set, it will apply the [crop filter](https://ffmpeg.org/ffmpeg-filters.html#crop) on the input to the given coordinates. General syntax is `w:h:x:y`                           |                              |
| `--use-crossfade-fix`  | when set, a special filter setup will be used to handle crossfade situations                                                                                                        |                              |
| `--crossfade-frames`   | assuming your input video has a framerate of ~30fps and your average cross-fade transition is 2 seconds long, the amount of frame should be at least `FPS * CROSSFADE_DURATION * 2` | `120`                        |
| `--silent`             | suppress output                                                                                                                                                                     |                              |
| `--img-uri`            | uri to prepend to the images in the json                                                                                                                                            |                              |
| `--pretty`             | pretty-print the output, if supported                                                                                                                                               |                              |
| `--keep-info`          | when set, info.txt will not be deleted                                                                                                                                              |                              |
| `--config`             | point to a yaml file that may contain all options for a enhanced re/usability, see below                                                                                            |                              |
| `--dump-ffmpeg`        | echo the generated ffmpeg-command to stdout                                                                                                                                         |                              |
| `--ffmpeg-binary`      | path to the ffmpeg binary, optional                                                                                                                                                 | `ffmpeg`                     |
| `--ffprobe-binary`     | path to the ffprobe binary, optional                                                                                                                                                | `ffprobe`                    |
| `--extract-audio`      | extract the audio from video file                                                                                                                                                   |                              |
| `--audio-filename`     | filename for the audio file. $filename will be replaced with input filename, same as `--output-folder`. Extension controls the output format                                        | `$filename.mp3`              |
| `--audio-options`      | options for the ffmpeg command that extracts the audio                                                                                                                              | `-q:a 0 -map a`              |
| `--audio-copy-stream`  | copy audio stream from video. Correct output file extension will be set automatically. `--audio-options` will be overwritten internally                                             |                              |
| `--audio-only`         | create no chapters and images                                                                                                                                                       |                              |
| `--input-chapters`     | path to a chapters.json file. See below                                                                                                                                             |                              |
| `--dump-options`       | dump final options object, for debugging only                                                                                                                                       |                              |
| `--min-chapter-length` | minimum chapter length. New chapters below that threshold are ignored                                                                                                               | `10`                         |
| `--no-end-times`       | when set, no endTime-attributes are written on chapters.json                                                                                                                        |                              |

### `convert`

Converts existing chapters between any of the supported formats:

| option                 | description                                                                         | default |
|------------------------|-------------------------------------------------------------------------------------|---------|
| `<input>`              | the file that you want to convert, format will be detected                          |         |
| `--output-format`             | target format, one of those listed above. When omitted, detected input format is used |         |
| `--pretty`             | some formats support pretty printing                                                |         |
| `--img-uri`            | see above, works only with `chaptersjson`                                           |         |
| `--output-file`        | file to write the output to. see below                                              |         |
| `--psd-omit-timecodes` | When set, first line of _PySceneDetect_-CSV will not be written                     |         |
| `--psd-framerate`      | set the framerate for _PySceneDetect_ output                                        |         |
| `--ac-use-text-attr`      | use the text-attribute for _Apple Chapters_            |      |

> use `--output-file` when using powershell, otherwise you'll have BOMs in your output 

## config yaml and .env

Use any option (except input) listed above in a config file passed via `--config`to create reusable configurations:

```yaml
# my-config.yaml
- --crop=616:410:554:46
- --silent
```

Additionally you can create an `.env` file in any directory and put in options like this:

```dotenv
# prefix with CT_, option name uppercase and replace all dashes with underscore
CT_CROP="616:410:554:46"
CT_SILENT=true
CT_DUMP_FFMEG=true
```

You can combine config with regular cli options. Evaluation occurs in this order:

1. build-in default value
2. `.env` values
3. config yaml (if present) value
4. explicit cli value

## Examples & FAQ

[examples.md](/examples.md), [FAQ](/faq.md)

## Docker 

Use docker to run the web GUI:

```shell
docker build -t chaptertool-gui .
docker run -p 8989:8989 chaptertool-gui
# open http://localhost:8989 in your browser
```

or use the image from dockerhub:

```shell
docker run -p 8989:8989 martintillmann/chaptertool-gui
```
