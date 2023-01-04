![chaptertool](../static/icons/icon-180.png)

# chaptertool

Create and convert chapters for podcasts, youtube, matroska, webvtt and ffmpeg.  

The cli tools can automatically create chapters with images from videos using ffmpeg's scene detection.

## [WEB GUI](https://mtillmann.github.io/chaptertool)

[Click here to open the web GUI](https://mtillmann.github.io/chaptertool).

## CLI Prerequisite

You need to install `node` and optionally `ffmpeg` on your system:

Windows: [modern terminal](https://github.com/microsoft/terminal), [package manager](https://chocolatey.org/), [node](https://www.startpage.com/sp/search?q=windows%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=windows%20install%20ffmpeg)   
macOS: [package manager](https://brew.sh/), [node](https://www.startpage.com/sp/search?q=macOS%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=macOS%20install%20ffmpeg)    
linux: [node](https://www.startpage.com/sp/search?q=linux%20install%20node), [ffmpeg](https://www.startpage.com/sp/search?q=linux%20install%20ffmpeg)

## create chapters from video

First, navigate your terminal to the folder that contains the video file. Next, run

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
| `--output-format`      | output format for the chapters                                                                                                                                                      | `chaptersjson`               | 
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

Converts existing chapters between the following formats:

- `chaptersjson` podcasting 2.0 chapters json file ([spec](https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md)) 
- `ffmpegdata` ffmpeg metadata format ([spec](https://ffmpeg.org/ffmpeg-formats.html#Metadata-1))
- `matroskaxml` matroska XML format ([spec](https://www.matroska.org/technical/chapters.html))
- `mkvmergexml` MKVToolNix mkvmerge XML format ([spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters))
- `mkvmergesimple` MKVToolNix mkvmerge "simple" format ([spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters))
- `webvtt` WebVTT chapter format ([spec](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API))
- `youtube` Youtube description chapter notation
- `ffmpeginfo` (readonly) ffmpeg scene detection output, used internally
 
| option          | description                                                                           | default |
|-----------------|---------------------------------------------------------------------------------------|---------|
| `<input>`       | the file that you want to convert, format will be detected                            |         |
| `--format`      | target format, one of those listed above. When omitted, detected input format is used |         |
| `--pretty`      | some formats support pretty printing                                                  |         |
| `--img-uri`     | see above, works only with `chaptersjson`                                             |         |
| `--output-file` | file to write the output to. see below                                                |         |

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


## Examples

Some of the examples require [yt-dlp](https://github.com/yt-dlp/yt-dlp).   

### cropping

[This video](https://www.youtube.com/watch?v=rpDWoshRnME) is a podcast with a slideshow version on youtube that
only uses a small portion of the video:

```shell
yt-dlp "https://www.youtube.com/watch?v=rpDWoshRnME" -o cropme.webm
npx chaptertool@latest generate cropme.webm --crop="926:608:831:72"
```

### handling cross-fade slideshows

[This video](https://www.youtube.com/watch?v=EL9ftQJ3Yjw) is a podcast with a slideshow version on youtube that
unfortunately uses cross-fade transitions between slides. Scene detection fails with those transitions
because the difference between the frames during the the transition is very small.

```shell
yt-dlp "https://www.youtube.com/watch?v=EL9ftQJ3Yjw" -o crossfaded.webm
npx chaptertool@latest generate crossfaded.webm --use-crossfade-fix
```

### Bad Display Aspect Ratio

[This video](https://cdn.media.ccc.de/events/gpn/gpn16/h264-sd/gpn16-7623-deu-Wie_baut_man_eigentlich_Raumschiffe_sd.mp4)
([from here](https://media.ccc.de/v/gpn16-7623-wie_baut_man_eigentlich_raumschiffe)) has a display aspect ratio of 16:9 (1.77)
but a natural resolution of 720x576 (1.25). Create images(1024x576) with square pixels like this:

```shell
wget "https://cdn.media.ccc.de/events/gpn/gpn16/h264-sd/gpn16-7623-deu-Wie_baut_man_eigentlich_Raumschiffe_sd.mp4" -o baddar.mp4
npx chaptertool@latest generate baddar.mp4 --force-dar
```