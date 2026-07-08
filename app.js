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
    quality: $("quality"),
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
    exporting: false,
    animationFrameId: null,
    downloadUrl: null
  };

  const QUALITY_PRESETS = {
    mobile: { maxSide: 720, fps: 15, bitrate: 2500000 },
    balanced: { maxSide: 1080, fps: 24, bitrate: 6000000 },
    high: { maxSide: 1440, fps: 30, bitrate: 10000000 }
  };

  const isMobileDevice = () => (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );

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

  function stopPreviewLoop() {
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
  }

  function startPreviewLoop() {
    stopPreviewLoop();
    state.animationFrameId = requestAnimationFrame(() => {
      state.animationFrameId = null;
      render();
    });
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

  function drawSelection(context = ctx) {
    if (!state.image || state.layer) return;
    const s = state.selection;
    context.save();
    context.lineWidth = Math.max(5, canvas.width / 170);
    context.strokeStyle = "#000000";
    context.shadowColor = "rgba(255,255,255,.92)";
    context.shadowBlur = 5;
    context.setLineDash([14, 8]);
    if (els.shapeSelect.value === "heart") {
      drawHeartPath(context, s.x, s.y, s.w, s.h);
      context.stroke();
    } else if (els.shapeSelect.value === "circle") {
      context.beginPath();
      context.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.strokeRect(s.x, s.y, s.w, s.h);
    }
    context.setLineDash([]);
    context.shadowBlur = 0;
    context.fillStyle = "#000000";
    context.fillRect(s.x + s.w - 18, s.y + s.h - 18, 18, 18);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(s.x + s.w - 18, s.y + s.h - 18, 18, 18);
    context.restore();
  }

  function paintFrame(timeMs, context = ctx, options = {}) {
    drawImageBase(context, options);
    drawLayer(timeMs, context);
    drawSelection(context);
  }

  function render(forcedTime, options = {}) {
    const now = forcedTime ?? (state.playing ? performance.now() - state.startedAt : state.pausedAt);
    paintFrame(now, ctx, options);
    if (state.playing && !state.exporting) startPreviewLoop();
  }

  async function loadImageFile(file) {
    if (state.exporting) return;
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
    if (state.exporting) return;
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
    if (state.exporting) return;
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
    if (state.exporting) return;
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
    if (state.exporting) return;
    if (state.drag) {
      canvas.releasePointerCapture(event.pointerId);
      state.drag = null;
    }
  }

  function resetAnimation() {
    if (state.exporting) return;
    state.pausedAt = 0;
    state.startedAt = performance.now();
    render(0);
  }

  function resetLayer() {
    if (state.exporting) return;
    stopPreviewLoop();
    state.layer = null;
    state.playing = false;
    state.pausedAt = 0;
    els.playPauseBtn.textContent = "Play";
    setMessage(state.image ? "Cut layer reset. Adjust the selection again." : "Upload an image to begin.", state.image ? "ok" : "");
    render(0);
  }

  function togglePlayback() {
    if (state.exporting) return;
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
      startPreviewLoop();
    } else {
      stopPreviewLoop();
      state.pausedAt = performance.now() - state.startedAt;
      els.playPauseBtn.textContent = "Play";
      render();
    }
  }

  function downloadBlob(blob, extension = "webm") {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    const url = URL.createObjectURL(blob);
    state.downloadUrl = url;
    const a = document.createElement("a");
    a.href = url;
    a.download = `loopcut-export.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      if (state.downloadUrl === url) {
        URL.revokeObjectURL(url);
        state.downloadUrl = null;
      }
    }, 30000);
  }

  function getExportSettings() {
    const preset = QUALITY_PRESETS[els.quality.value] || QUALITY_PRESETS.balanced;
    const durationSeconds = Math.round(clamp(Number(els.duration.value) || 5, 1, 60));
    const fps = Math.round(clamp(Number(els.fps.value) || preset.fps, 1, 60));
    const totalFrames = Math.max(1, durationSeconds * fps);
    const frameDurationMs = 1000 / fps;
    const scale = Math.min(1, preset.maxSide / Math.max(canvas.width, canvas.height));
    return {
      preset,
      durationSeconds,
      fps,
      totalFrames,
      frameDurationMs,
      width: Math.max(2, Math.round(canvas.width * scale)),
      height: Math.max(2, Math.round(canvas.height * scale))
    };
  }

  function setControlsLocked(locked) {
    [
      els.imageInput,
      els.playPauseBtn,
      els.createLayerBtn,
      els.resetAnimBtn,
      els.resetLayerBtn,
      els.shapeSelect,
      els.cutWidth,
      els.cutHeight,
      els.motionEffect,
      els.direction,
      els.speed,
      els.rotation,
      els.scale,
      els.opacity,
      els.duration,
      els.quality,
      els.fps,
      els.exportFormat,
      els.backgroundColor
    ].forEach((el) => {
      el.disabled = locked;
    });
    els.exportBtn.disabled = locked;
  }

  function waitUntil(targetTime) {
    const remaining = targetTime - performance.now();
    if (remaining <= 1) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, remaining));
  }

  function waitForRecorderStop(recorder) {
    return new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error("Recording failed."));
    });
  }

  function createExportCanvas(width, height) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext("2d", { alpha: true });
    return { exportCanvas, exportCtx };
  }

  function renderExportFrame(exportCtx, frameIndex, settings, options) {
    const scaleX = settings.width / canvas.width;
    const scaleY = settings.height / canvas.height;
    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
    exportCtx.clearRect(0, 0, settings.width, settings.height);
    exportCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    paintFrame((frameIndex / settings.fps) * 1000, exportCtx, options);
    exportCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function readEbmlId(bytes, offset) {
    const first = bytes[offset];
    if (first === undefined) return null;
    let length = 1;
    let marker = 0x80;
    while (length <= 4 && !(first & marker)) {
      marker >>= 1;
      length += 1;
    }
    if (length > 4 || offset + length > bytes.length) return null;
    let value = 0;
    for (let i = 0; i < length; i += 1) value = (value << 8) | bytes[offset + i];
    return { value, length };
  }

  function readEbmlSize(bytes, offset) {
    const first = bytes[offset];
    if (first === undefined) return null;
    let length = 1;
    let marker = 0x80;
    while (length <= 8 && !(first & marker)) {
      marker >>= 1;
      length += 1;
    }
    if (length > 8 || offset + length > bytes.length) return null;
    let value = first & (marker - 1);
    let unknown = value === marker - 1;
    for (let i = 1; i < length; i += 1) {
      value = (value * 256) + bytes[offset + i];
      unknown = unknown && bytes[offset + i] === 0xff;
    }
    return { value, length, unknown };
  }

  function encodeEbmlSize(value, length) {
    const max = Math.pow(2, (7 * length)) - 2;
    if (value > max) return null;
    const encoded = new Uint8Array(length);
    let remaining = value;
    for (let i = length - 1; i >= 0; i -= 1) {
      encoded[i] = remaining & 0xff;
      remaining = Math.floor(remaining / 256);
    }
    encoded[0] |= 1 << (8 - length);
    return encoded;
  }

  function findEbmlElement(bytes, start, end, targetId) {
    let offset = start;
    while (offset < end) {
      const id = readEbmlId(bytes, offset);
      if (!id) return null;
      const size = readEbmlSize(bytes, offset + id.length);
      if (!size) return null;
      const headerStart = offset;
      const dataStart = offset + id.length + size.length;
      const dataEnd = size.unknown ? end : dataStart + size.value;
      if (dataEnd > bytes.length) return null;
      const element = { headerStart, dataStart, dataEnd, idLength: id.length, sizeLength: size.length, size };
      if (id.value === targetId) return element;
      offset = dataEnd;
    }
    return null;
  }

  function readUnsignedEbml(bytes, start, end) {
    let value = 0;
    for (let i = start; i < end; i += 1) value = (value * 256) + bytes[i];
    return value;
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  async function fixWebmDuration(blob, durationSeconds) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const segment = findEbmlElement(bytes, 0, bytes.length, 0x18538067);
    if (!segment) return blob;
    const info = findEbmlElement(bytes, segment.dataStart, segment.dataEnd, 0x1549a966);
    if (!info) return blob;
    const timecodeScale = findEbmlElement(bytes, info.dataStart, info.dataEnd, 0x2ad7b1);
    const scale = timecodeScale ? readUnsignedEbml(bytes, timecodeScale.dataStart, timecodeScale.dataEnd) : 1000000;
    const durationValue = durationSeconds * 1000000000 / scale;
    const durationPayload = new Uint8Array(8);
    new DataView(durationPayload.buffer).setFloat64(0, durationValue, false);
    const durationElement = concatBytes([new Uint8Array([0x44, 0x89, 0x88]), durationPayload]);
    const existingDuration = findEbmlElement(bytes, info.dataStart, info.dataEnd, 0x4489);

    if (existingDuration) {
      const payloadLength = existingDuration.dataEnd - existingDuration.dataStart;
      const nextBytes = new Uint8Array(bytes);
      if (payloadLength === 4) {
        new DataView(nextBytes.buffer).setFloat32(existingDuration.dataStart, durationValue, false);
      } else if (payloadLength === 8) {
        new DataView(nextBytes.buffer).setFloat64(existingDuration.dataStart, durationValue, false);
      } else {
        return blob;
      }
      return new Blob([nextBytes], { type: blob.type });
    }

    const nextInfoSize = info.size.value + durationElement.length;
    const encodedInfoSize = encodeEbmlSize(nextInfoSize, info.sizeLength);
    if (!encodedInfoSize || info.size.unknown) return blob;

    const head = bytes.slice(0, info.headerStart + info.idLength);
    const infoBodyStart = bytes.slice(info.dataStart, info.dataEnd);
    const tail = bytes.slice(info.dataEnd);
    const nextBytes = concatBytes([head, encodedInfoSize, durationElement, infoBodyStart, tail]);

    if (!segment.size.unknown) {
      const nextSegmentSize = segment.size.value + durationElement.length;
      const encodedSegmentSize = encodeEbmlSize(nextSegmentSize, segment.sizeLength);
      if (!encodedSegmentSize) return blob;
      nextBytes.set(encodedSegmentSize, segment.headerStart + segment.idLength);
    }
    return new Blob([nextBytes], { type: blob.type });
  }

  async function exportVideo() {
    if (state.exporting) return setMessage("An export is already running.", "error");
    if (!state.image) return setMessage("No image uploaded.", "error");
    if (!state.layer) return setMessage("No selection created. Create a cut layer first.", "error");
    if (!canvas.captureStream || !window.MediaRecorder) {
      return setMessage("Browser does not support MediaRecorder export.", "error");
    }
    const settings = getExportSettings();
    if (isMobileDevice() && els.quality.value === "high" && !window.confirm("High Quality export can be slow on mobile devices. Continue?")) {
      return;
    }
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
    const wasPlaying = state.playing;
    const resumeAt = state.playing ? performance.now() - state.startedAt : state.pausedAt;
    state.exporting = true;
    state.playing = false;
    stopPreviewLoop();
    setControlsLocked(true);
    els.exportBtn.textContent = "Exporting...";
    els.exportProgress.value = 0;
    setMessage(`Preparing ${settings.durationSeconds}s export at ${settings.fps} FPS...`, "ok");

    let stream = null;
    let exportCanvas = null;
    let exportCtx = null;
    try {
      const created = createExportCanvas(settings.width, settings.height);
      exportCanvas = created.exportCanvas;
      exportCtx = created.exportCtx;
      stream = exportCanvas.captureStream(settings.fps);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: settings.preset.bitrate });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      const done = waitForRecorderStop(recorder);
      recorder.start();

      const startedAt = performance.now();
      setMessage(`Rendering 0 / ${settings.totalFrames} frames...`, "ok");
      for (let frame = 0; frame <= settings.totalFrames; frame += 1) {
        await waitUntil(startedAt + frame * settings.frameDurationMs);
        renderExportFrame(exportCtx, frame, settings, { forceBackground, backgroundColor, transparentCut });
        const completedFrames = Math.min(frame + 1, settings.totalFrames);
        els.exportProgress.value = Math.round((completedFrames / settings.totalFrames) * 100);
        if (frame % Math.max(1, Math.round(settings.fps / 2)) === 0 || frame >= settings.totalFrames) {
          setMessage(`Rendering ${completedFrames} / ${settings.totalFrames} frames...`, "ok");
        }
      }
      await waitUntil(startedAt + (settings.durationSeconds * 1000) + settings.frameDurationMs);
      setMessage("Finalizing export...", "ok");
      recorder.stop();
      await done;
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (!blob.size) throw new Error("Export failed.");
      const finalBlob = extension === "webm" ? await fixWebmDuration(blob, settings.durationSeconds) : blob;
      downloadBlob(finalBlob, extension);
      const nextCount = Number(storage.get(exportKey, "0")) + 1;
      storage.set(exportKey, String(nextCount));
      syncCounter();
      setMessage("Download ready. Download started.", "ok");
    } catch (error) {
      setMessage(error.message || "Export failed.", "error");
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (exportCtx && exportCanvas) exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx = null;
      exportCanvas = null;
      state.exporting = false;
      setControlsLocked(false);
      els.exportBtn.textContent = "Export Video";
      els.exportProgress.value = 0;
      state.pausedAt = resumeAt;
      if (wasPlaying) {
        state.playing = true;
        state.startedAt = performance.now() - resumeAt;
        els.playPauseBtn.textContent = "Pause";
        startPreviewLoop();
      } else {
        state.playing = false;
        els.playPauseBtn.textContent = "Play";
        render(state.pausedAt);
      }
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
    els.quality.addEventListener("change", () => {
      const preset = QUALITY_PRESETS[els.quality.value] || QUALITY_PRESETS.balanced;
      els.fps.value = String(preset.fps);
      setMessage(`${els.quality.selectedOptions[0].textContent} export set to ${preset.fps} FPS.`, "ok");
    });
    els.fps.addEventListener("change", () => {
      const preset = QUALITY_PRESETS[els.quality.value] || QUALITY_PRESETS.balanced;
      if (Number(els.fps.value) > preset.fps && els.quality.value === "mobile") {
        setMessage("Mobile Safe works best at 12-15 FPS.", "ok");
      }
    });
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
  if (isMobileDevice()) {
    els.quality.value = "mobile";
    els.fps.value = String(QUALITY_PRESETS.mobile.fps);
  }
  syncCounter();
  updateControlLabels();
  render(0);
})();
