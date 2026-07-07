# LoopCut Motion Studio

LoopCut Motion Studio is a browser-only motion editor for cutting a selected region from an uploaded image, animating that cut layer, previewing the loop live, and exporting the result as a video.

## Run locally

Open `index.html` directly in a modern browser, or serve the folder with any static file server. No backend, database, cloud upload, or build step is required.

## Deploy on GitHub Pages

1. Push this folder to a GitHub repository.
2. Open repository **Settings > Pages**.
3. Select the branch and folder that contain `index.html`.
4. Save and open the published GitHub Pages URL.

## Export formats

The app uses browser-native `canvas.captureStream()` and `MediaRecorder`.

- **WebM**: primary lightweight export format.
- **Transparent WebM**: preserves canvas alpha where the browser supports alpha-capable WebM recording.
- **MP4**: exported only if the browser supports `video/mp4;codecs=h264` or `video/mp4` in `MediaRecorder`.

If MP4 is not supported, the app clearly reports the limitation and exports WebM instead. It never renames a WebM file as MP4.

## Transparency note

Transparent PNG/WebP image areas are preserved in canvas processing. MP4 transparency is not normally supported in browser-only export, so MP4 uses the selected background color. Use **Transparent WebM** when alpha video is needed and supported by the browser.

## Browser support

Best support is in current Chromium-based browsers. Firefox supports WebM MediaRecorder flows. Safari support depends on the installed version and available MediaRecorder MIME support.

## Privacy

Everything runs locally in your browser. Your images are not uploaded anywhere. The successful export counter and selected theme are stored only in `localStorage` on the same device.

## Technical limitation

Browser-only MP4 export and MP4 transparency are limited by each browser's MediaRecorder implementation. The project does not use backend conversion or heavyweight bundled encoders.
