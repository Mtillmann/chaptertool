# chaptertool - frequently asked questions

## Are videos uploaded to a server?
No. All processing is done on your device. No image, video, audio or chapters-file is ever uploaded. 

## Where are the zips generated?
All downloads, including zipfiles containing images, are generated on your device.

## Does automatic chapter generation work in the web app?
No, at the moment chapter generation only works with the cli app. Although ffmpeg.js exists, I doubt that it'd be 
worth the effort to implement it in the browser.

## Can chaptertool publish or upload the chapters to my webserver?
No, not at the moment but there are plans.

## Can I run the chaptertool web app on my own machine or locally?
Yes, run `npx --yes chaptertool@latest serve`.

## Can I install chaptertool on my machine?
Yes, chaptertool supports PWA functionality. If you use a chromium-based browser (chrome, brave, edge, vivaldi)
the option to install the app locally should appear on the right in the address bar

## What data is tracked?
When analytics is enabled, only superficial usage is tracked. No filenames, chapter titles or any other
actual user input is ever transmitted to google.

## What are good scene detection values?
Generally use half of the percentage of the video canvas that actually changes: 

For regular full motion videos, you'll have good results with a value of 0.5. A smaller value will create  
more stills, a higher value less.

For slideshow videos that only use a portion of the screen for the actual content, the value must be smaller
than fraction of the image that is used. 

For example, this ... uses only ~20-27% of the video canvas for the actual slideshow, so any value scene-value
above 0.27 will produce no snapshots at all because 73% of any two frames is identical. A scene value of 0.2 will
produce some output while 0.1 produces a good amount. 0.1 is approximately half of the size of the smallest
images used inside the video.

Likewise, for talks and lectures that show slides you should figure out how much of the 
screen a slide shown in the video takes up and use half of that percentage.

## How does min chapter length work?
After the ffmpeg processing is done, the result is parsed and entries that are shorter that the given min
chapter length are removed. Afterwards the images are deleted and renamed.

## Why use npx?
`npx` is a good alternative to `npm i X -g`. Using `npx chaptertool@latest` makes sure that you always use
the latest version without to remember to update your global npm install. 

## How can I skip the npx install prompt?
If you want to make sure that your process always uses the latest version without hanging on the install prompt, use
`npx --yes chaptertool@latest`

## How to add ffmetadata chapters to video?
```shell
ffmpeg -i INPUT.mp4 -i FFMETADATAFILE.txt -map_metadata 1 -codec copy OUTPUT.mp4
```
via [Kyle Howells' blog](https://ikyle.me/blog/2020/add-mp4-chapters-ffmpeg)

## How to add mkvmerge chapters to a mkv?
```yaml
mkvmerge --chapters chapters.txt -o output.mkv input-file.mkv
# xml and simple formats work the same way
```
via [programster's blog](https://blog.programster.org/add-chapters-to-mkv-file)

## How to add matroskaxml chapters to a mkv?
I honestly have no idea, just use the mkvmerge chapters or let me know if you know.

## how to use youtube chapters?
Paste the output in your video's description. Youtube will link the timestamps automatically. The first timestamp must 
be 00:00.

## how to use WebVTT chapters?
[see MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API)

## What's the difference between mkvmergesimple and vorbis comment?
[mkvmergesimple](https://savvyadmin.com/adding-chapters-to-videos-using-mkv-containers/#:~:text=chapter.txt.-,CHAPTER01,-%3D00%3A00%3A00.000) apparently pads the chapter index to 2 digits, while [vorbis comment](https://wiki.xiph.org/Chapter_Extension#:~:text=two%20sequential%20chapters%3A-,CHAPTER001,-%3D00%3A00%3A00.000) uses 3 digits.

## How to use the apple chapters?
I honestly don't know as the only reference I could find is [NVEnc's documentation](https://github.com/rigaya/NVEnc/blob/master/NVEncC_Options.en.md#--chapter-string:~:text=CHAPTER03NAME%3Dchapter%2D3-,apple%20format,-(should%20be%20in)

## What does "chapter/timeline lock" do?
When enabled, clicking anywhere on the timeline will select the chapter below. When disabled you can click on the timeline without the chapter below being selected and scrolled into view.