(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("stage");
  const ctx = canvas.getContext("2d");
  const els = {
    imageInput: $("imageInput"),
    dropZone: $("dropZone"),
    message: $("message"),
    canvasMeta: $("canvasMeta"),
    exportCount: $("exportCount"),
    playPauseBtn: $("playPauseBtn"),
    createLayerBtn: $("createLayerBtn"),
    resetAnimBtn: $("resetAnimBtn"),
    resetLayerBtn: $("resetLayerBtn"),
    shapeSelect: $("shapeSelect"),
    cutWidth: $("cutWidth"),
    cutHeight: $("cutHeight"),
    cutWidthValue: $("cutWidthValue"),
    cutHeightValue: $("cutHeightValue"),
    motionEffect: $("motionEffect"),
    direction: $("direction"),
    speed: $("speed"),
    speedValue: $("speedValue"),
    rotation: $("rotation"),
    rotationValue: $("rotationValue"),
    scale: $("scale"),
    scaleValue: $("scaleValue"),
    opacity: $("opacity"),
    opacityValue: $("opacityValue"),
    duration: $("duration"),
    fps: $("fps"),
    exportFormat: $("exportFormat"),
    backgroundColor: $("backgroundColor"),
    themeToggle: $("themeToggle"),
    exportBtn: $("exportBtn"),
    exportProgress: $("exportProgress")
  };

  const MAX_SOURCE_SIDE = 2400;
  const MAX_STAGE_SIDE = 1280;
  const exportKey = "loopcutSuccessfulExports";
  const themeKey = "loopcutTheme";
  const state = {
    image: null,
    originalWidth: 0,
    originalHeight: 0,
    view: { x: 0, y: 0, w: canvas.width, h: canvas.height },
    selection: { x: 390, y: 245, w: 180, h: 150 },
    layer: null,
    playing: false,
    startedAt: 0,
    pausedAt: 0,
    diagonal: { vx: 140, vy: 110 },
    drag: null,
    exporting: false
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (value, size) => ((value % size) + size) % size;
  const storage = {
    get(key, fallback = "") {
      try {
        return localStorage.getItem(key) || fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        return false;
      }
      return true;
    }
  };

  function setMessage(text, type = "") {
    els.message.textContent = text;
    els.message.className = `message ${type}`.trim();
  }

  function syncCounter() {
    els.exportCount.textContent = storage.get(exportKey, "0");
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    els.themeToggle.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
    els.themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
    storage.set(themeKey, nextTheme);
  }

  function updateControlLabels() {
    els.cutWidthValue.textContent = `${Math.round(state.selection.w)}px`;
    els.cutHeightValue.textContent = `${Math.round(state.selection.h)}px`;
    els.speedValue.textContent = `${Number(els.speed.value).toFixed(1)}x`;
    els.rotationValue.textContent = `${els.rotation.value}deg`;
    els.scaleValue.textContent = `${Number(els.scale.value).toFixed(2)}x`;
    els.opacityValue.textContent = `${Math.round(Number(els.opacity.value) * 100)}%`;
  }

  function fitCanvasToImage(width, height) {
    const ratio = width / height;
    let targetW = width;
    let targetH = height;
    if (targetW > MAX_STAGE_SIDE || targetH > MAX_STAGE_SIDE) {
      const scale = Math.min(MAX_STAGE_SIDE / targetW, MAX_STAGE_SIDE / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
    targetW = Math.max(360, targetW);
    targetH = Math.round(targetW / ratio);
    if (targetH > MAX_STAGE_SIDE) {
      targetH = MAX_STAGE_SIDE;
      targetW = Math.round(targetH * ratio);
    }
    canvas.width = Math.round(targetW);
    canvas.height = Math.round(targetH);
    state.view = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    centerSelection();
  }

  function centerSelection() {
    const size = Math.min(canvas.width, canvas.height);
    state.selection.w = clamp(Number(els.cutWidth.value), 30, Math.max(30, canvas.width));
    state.selection.h = clamp(Number(els.cutHeight.value), 30, Math.max(30, canvas.height));
    if (size < 380) {
      state.selection.w = Math.min(state.selection.w, size * 0.55);
      state.selection.h = Math.min(state.selection.h, size * 0.48);
    }
    state.selection.x = (canvas.width - state.selection.w) / 2;
    state.selection.y = (canvas.height - state.selection.h) / 2;
  }

  function drawHeartPath(context, x, y, w, h) {
    context.beginPath();
    context.moveTo(x + w / 2, y + h * 0.92);
    context.bezierCurveTo(x + w * -0.08, y + h * 0.55, x + w * 0.06, y + h * 0.06, x + w * 0.34, y + h * 0.13);
    context.bezierCurveTo(x + w * 0.45, y + h * 0.16, x + w * 0.5, y + h * 0.28, x + w / 2, y + h * 0.31);
    context.bezierCurveTo(x + w * 0.5, y + h * 0.28, x + w * 0.55, y + h * 0.16, x + w * 0.66, y + h * 0.13);
    context.bezierCurveTo(x + w * 0.94, y + h * 0.06, x + w * 1.08, y + h * 0.55, x + w / 2, y + h * 0.92);
    context.closePath();
  }

  function clipShape(context, shape, x, y, w, h) {
    context.beginPath();
    if (shape === "circle") {
      context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (shape === "heart") {
      drawHeartPath(context, x, y, w, h);
    } else {
      context.rect(x, y, w, h);
    }
    context.clip();
  }

  function drawImageBase(context = ctx, options = {}) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (options.forceBackground) {
      context.fillStyle = options.backgroundColor || els.backgroundColor.value || "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (!state.image) {
      context.fillStyle = "#5e6b7a";
      context.textAlign = "center";
      context.font = "900 22px Arial, Helvetica, sans-serif";
      context.fillText("Upload an image", canvas.width / 2, canvas.height / 2);
      return;
    }
    context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
    drawCutVoid(context, options);
  }

  function drawCutVoid(context = ctx, options = {}) {
    if (!state.layer) return;
    const layer = state.layer;
    context.save();
    if (options.transparentCut) {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000000";
    } else {
      context.fillStyle = "#000000";
    }
    clipShape(context, layer.shape, layer.x, layer.y, layer.w, layer.h);
    context.fillRect(layer.x, layer.y, layer.w, layer.h);
    context.restore();
  }

  function motionOffset(timeMs, layer = state.layer) {
    if (!layer) return { x: 0, y: 0, r: 0 };
    const speed = Number(els.speed.value);
    const dir = els.direction.value === "reverse" ? -1 : 1;
    const t = (timeMs / 1000) * speed * dir;
    const phase = mod(t / 2.6, 1);
    const spanX = canvas.width + layer.w;
    const spanY = canvas.height + layer.h;
    const effect = els.motionEffect.value;

    if (effect === "ltr") return { x: -layer.x - layer.w + spanX * phase, y: 0, r: 0 };
    if (effect === "rtl") return { x: canvas.width - layer.x - spanX * phase, y: 0, r: 0 };
    if (effect === "ttb") return { x: 0, y: -layer.y - layer.h + spanY * phase, r: 0 };
    if (effect === "btt") return { x: 0, y: canvas.height - layer.y - spanY * phase, r: 0 };

    const bounce = Math.abs(Math.sin(t * Math.PI / 2));
    if (effect === "diagonal") {
      const elapsed = Math.max(0, timeMs / 1000) * Math.max(0.1, speed);
      const maxX = Math.max(0, canvas.width - layer.w);
      const maxY = Math.max(0, canvas.height - layer.h);
      const bouncePos = (distance, max) => {
        if (max <= 0) return 0;
        const cycle = max * 2;
        const value = mod(distance, cycle);
        return value <= max ? value : cycle - value;
      };
      const x = bouncePos(layer.x + state.diagonal.vx * elapsed * dir, maxX);
      const y = bouncePos(layer.y + state.diagonal.vy * elapsed * dir, maxY);
      return { x: x - layer.x, y: y - layer.y, r: 0 };
    }
    if (effect === "hbounce") return { x: lerp(-layer.x, canvas.width - layer.x - layer.w, bounce), y: 0, r: 0 };
    if (effect === "vbounce") return { x: 0, y: lerp(-layer.y, canvas.height - layer.y - layer.h, bounce), r: 0 };
    if (effect === "orbit") {
      const radius = Math.min(canvas.width, canvas.height) * 0.08;
      return { x: Math.cos(t * Math.PI) * radius, y: Math.sin(t * Math.PI) * radius, r: t * 22 };
    }
    if (effect === "shake") {
      return { x: Math.sin(t * 38) * 9, y: Math.cos(t * 43) * 7, r: Math.sin(t * 52) * 3 };
    }
    return { x: Math.sin(t * Math.PI) * canvas.width * 0.18, y: Math.sin(t * Math.PI * .5) * canvas.height * 0.08, r: 0 };
  }

  function drawLayer(timeMs, context = ctx) {
    const layer = state.layer;
    if (!layer) return;
    const offset = motionOffset(timeMs, layer);
    const scale = Number(els.scale.value);
    const rotation = (Number(els.rotation.value) + offset.r) * Math.PI / 180;
    const cx = layer.x + layer.w / 2 + offset.x;
    const cy = layer.y + layer.h / 2 + offset.y;
    context.save();
    context.globalAlpha = Number(els.opacity.value);
    context.translate(cx, cy);
    context.rotate(rotation);
    context.scale(scale, scale);
    context.drawImage(layer.canvas, -layer.w / 2, -layer.h / 2, layer.w, layer.h);
    context.restore();
  }

  function drawSelection() {
    if (!state.image || state.layer) return;
    const s = state.selection;
    ctx.save();
    ctx.lineWidth = Math.max(5, canvas.width / 170);
    ctx.strokeStyle = "#000000";
    ctx.shadowColor = "rgba(255,255,255,.92)";
    ctx.shadowBlur = 5;
    ctx.setLineDash([14, 8]);
    if (els.shapeSelect.value === "heart") {
      drawHeartPath(ctx, s.x, s.y, s.w, s.h);
      ctx.stroke();
    } else if (els.shapeSelect.value === "circle") {
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#000000";
    ctx.fillRect(s.x + s.w - 18, s.y + s.h - 18, 18, 18);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + s.w - 18, s.y + s.h - 18, 18, 18);
    ctx.restore();
  }

  function render(forcedTime, options = {}) {
    const now = forcedTime ?? (state.playing ? performance.now() - state.startedAt : state.pausedAt);
    drawImageBase(ctx, options);
    drawLayer(now, ctx);
    drawSelection();
    if (state.playing && !state.exporting) requestAnimationFrame(render);
  }

  async function loadImageFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Unsupported file type. Use JPG, PNG, or WEBP.", "error");
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setMessage("Image is very large. It will be scaled for browser safety.", "error");
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > MAX_SOURCE_SIDE || img.height > MAX_SOURCE_SIDE) {
        setMessage("Large image loaded and preview was capped to prevent memory issues.", "ok");
      } else {
        setMessage("Image loaded. Position the cut shape and create a layer.", "ok");
      }
      state.image = img;
      state.originalWidth = img.width;
      state.originalHeight = img.height;
      state.layer = null;
      state.playing = false;
      state.pausedAt = 0;
      els.playPauseBtn.textContent = "Play";
      fitCanvasToImage(img.width, img.height);
      els.canvasMeta.textContent = `${img.width} x ${img.height}`;
      render(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setMessage("Could not read this image.", "error");
    };
    img.src = url;
  }

  function createCutLayer() {
    if (!state.image) {
      setMessage("No image uploaded.", "error");
      return;
    }
    const s = state.selection;
    if (s.w < 8 || s.h < 8) {
      setMessage("No valid selection created.", "error");
      return;
    }
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = Math.round(s.w);
    layerCanvas.height = Math.round(s.h);
    const layerCtx = layerCanvas.getContext("2d");
    layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    layerCtx.save();
    clipShape(layerCtx, els.shapeSelect.value, 0, 0, layerCanvas.width, layerCanvas.height);
    layerCtx.drawImage(
      state.image,
      s.x * (state.image.width / canvas.width),
      s.y * (state.image.height / canvas.height),
      s.w * (state.image.width / canvas.width),
      s.h * (state.image.height / canvas.height),
      0,
      0,
      layerCanvas.width,
      layerCanvas.height
    );
    layerCtx.restore();
    state.layer = { canvas: layerCanvas, x: s.x, y: s.y, w: s.w, h: s.h, shape: els.shapeSelect.value };
    state.pausedAt = 0;
    state.startedAt = performance.now();
    setMessage("Cut layer created.", "ok");
    render(0);
  }

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function inSelection(pos) {
    const s = state.selection;
    return pos.x >= s.x && pos.y >= s.y && pos.x <= s.x + s.w && pos.y <= s.y + s.h;
  }

  function inHandle(pos) {
    const s = state.selection;
    return pos.x >= s.x + s.w - 28 && pos.y >= s.y + s.h - 28 && pos.x <= s.x + s.w + 8 && pos.y <= s.y + s.h + 8;
  }

  function onPointerDown(event) {
    if (!state.image || state.layer) return;
    const pos = pointerPos(event);
    if (!inSelection(pos)) return;
    canvas.setPointerCapture(event.pointerId);
    state.drag = {
      type: inHandle(pos) ? "resize" : "move",
      startX: pos.x,
      startY: pos.y,
      original: { ...state.selection }
    };
  }

  function onPointerMove(event) {
    if (!state.drag) return;
    const pos = pointerPos(event);
    const dx = pos.x - state.drag.startX;
    const dy = pos.y - state.drag.startY;
    const s = state.selection;
    if (state.drag.type === "move") {
      s.x = clamp(state.drag.original.x + dx, 0, canvas.width - s.w);
      s.y = clamp(state.drag.original.y + dy, 0, canvas.height - s.h);
    } else {
      s.w = clamp(state.drag.original.w + dx, 30, canvas.width - s.x);
      s.h = clamp(state.drag.original.h + dy, 30, canvas.height - s.y);
      els.cutWidth.value = Math.round(clamp(s.w, Number(els.cutWidth.min), Number(els.cutWidth.max)));
      els.cutHeight.value = Math.round(clamp(s.h, Number(els.cutHeight.min), Number(els.cutHeight.max)));
      updateControlLabels();
    }
    render();
  }

  function onPointerUp(event) {
    if (state.drag) {
      canvas.releasePointerCapture(event.pointerId);
      state.drag = null;
    }
  }

  function resetAnimation() {
    state.pausedAt = 0;
    state.startedAt = performance.now();
    render(0);
  }

  function resetLayer() {
    state.layer = null;
    state.playing = false;
    state.pausedAt = 0;
    els.playPauseBtn.textContent = "Play";
    setMessage(state.image ? "Cut layer reset. Adjust the selection again." : "Upload an image to begin.", state.image ? "ok" : "");
    render(0);
  }

  function togglePlayback() {
    if (!state.image) {
      setMessage("No image uploaded.", "error");
      return;
    }
    if (!state.layer) {
      setMessage("No selection created. Create a cut layer first.", "error");
      return;
    }
    state.playing = !state.playing;
    if (state.playing) {
      state.startedAt = performance.now() - state.pausedAt;
      els.playPauseBtn.textContent = "Pause";
      requestAnimationFrame(render);
    } else {
      state.pausedAt = performance.now() - state.startedAt;
      els.playPauseBtn.textContent = "Play";
      render();
    }
  }

  function downloadBlob(blob, extension = "webm") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loopcut-export.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportVideo() {
    if (!state.image) return setMessage("No image uploaded.", "error");
    if (!state.layer) return setMessage("No selection created. Create a cut layer first.", "error");
    if (!canvas.captureStream || !window.MediaRecorder) {
      return setMessage("Browser does not support MediaRecorder export.", "error");
    }
    const fps = Number(els.fps.value);
    const durationMs = Number(els.duration.value) * 1000;
    const totalFrames = Math.round((durationMs / 1000) * fps);
    const frameDelay = 1000 / fps;
    const requestedFormat = els.exportFormat.value;
    const transparentCut = requestedFormat === "webm-alpha";
    const forceBackground = requestedFormat === "mp4";
    const backgroundColor = els.backgroundColor.value || "#ffffff";
    const webmMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    let mime = webmMime;
    let extension = "webm";
    if (requestedFormat !== "mp4" && !MediaRecorder.isTypeSupported(webmMime)) {
      return setMessage("This browser does not support WebM MediaRecorder export.", "error");
    }
    if (requestedFormat === "mp4") {
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264")) {
        mime = "video/mp4;codecs=h264";
        extension = "mp4";
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mime = "video/mp4";
        extension = "mp4";
      } else {
        setMessage("Your browser does not support direct MP4 export. Exporting WebM instead.", "error");
      }
    } else if (requestedFormat === "webm-alpha") {
      setMessage("Transparent WebM preserves canvas alpha when supported by this browser.", "ok");
    }
    const chunks = [];
    state.exporting = true;
    state.playing = false;
    els.exportBtn.disabled = true;
    els.exportBtn.textContent = "Exporting...";
    els.exportProgress.value = 0;
    setMessage("Preparing export...", "ok");

    try {
      const stream = canvas.captureStream(0);
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || typeof videoTrack.requestFrame !== "function") {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot export exact-frame canvas video.");
      }
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 7000000 });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      const done = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(new Error("Recording failed."));
      });
      recorder.start(100);
      setMessage("Recording export...", "ok");
      for (let frame = 0; frame < totalFrames; frame += 1) {
        render(frame * frameDelay, { forceBackground, backgroundColor, transparentCut });
        if (videoTrack && typeof videoTrack.requestFrame === "function") videoTrack.requestFrame();
        els.exportProgress.value = Math.round(((frame + 1) / totalFrames) * 100);
        await new Promise((resolve) => setTimeout(resolve, frameDelay));
      }
      setMessage("Finalizing export...", "ok");
      recorder.stop();
      await done;
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: "video/webm" });
      if (!blob.size) throw new Error("Export failed.");
      downloadBlob(blob, extension);
      const nextCount = Number(storage.get(exportKey, "0")) + 1;
      storage.set(exportKey, String(nextCount));
      syncCounter();
      setMessage("Download ready. Download started.", "ok");
    } catch (error) {
      setMessage(error.message || "Export failed.", "error");
    } finally {
      state.exporting = false;
      els.exportBtn.disabled = false;
      els.exportBtn.textContent = "Export Video";
      els.exportProgress.value = 0;
      render(state.pausedAt);
    }
  }

  function bind() {
    els.imageInput.addEventListener("change", (event) => loadImageFile(event.target.files[0]));
    ["dragenter", "dragover"].forEach((name) => {
      els.dropZone.addEventListener(name, (event) => {
        event.preventDefault();
        els.dropZone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach((name) => {
      els.dropZone.addEventListener(name, () => els.dropZone.classList.remove("dragging"));
    });
    els.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      loadImageFile(event.dataTransfer.files[0]);
    });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    els.createLayerBtn.addEventListener("click", createCutLayer);
    els.playPauseBtn.addEventListener("click", togglePlayback);
    els.resetAnimBtn.addEventListener("click", resetAnimation);
    els.resetLayerBtn.addEventListener("click", resetLayer);
    els.exportBtn.addEventListener("click", exportVideo);
    els.themeToggle.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    els.exportFormat.addEventListener("change", () => {
      const format = els.exportFormat.value;
      if (format === "mp4") {
        setMessage("MP4 uses the selected background color because browser MP4 alpha is not normally supported.", "ok");
      } else if (format === "webm-alpha") {
        setMessage("Transparent WebM preserves canvas alpha when supported by this browser.", "ok");
      }
    });
    [els.shapeSelect, els.motionEffect, els.direction, els.speed, els.rotation, els.scale, els.opacity].forEach((el) => {
      el.addEventListener("input", () => {
        updateControlLabels();
        render();
      });
    });
    [els.cutWidth, els.cutHeight].forEach((el) => {
      el.addEventListener("input", () => {
        state.selection.w = clamp(Number(els.cutWidth.value), 30, canvas.width - state.selection.x);
        state.selection.h = clamp(Number(els.cutHeight.value), 30, canvas.height - state.selection.y);
        updateControlLabels();
        render();
      });
    });
  }

  bind();
  applyTheme(storage.get(themeKey, "light"));
  syncCounter();
  updateControlLabels();
  render(0);
})();
