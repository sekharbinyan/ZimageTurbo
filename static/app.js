const form = document.getElementById("generate-form");
const modeButtons = document.querySelectorAll(".mode-btn");
const imageBlock = document.getElementById("image-block");
const sizeBlock = document.getElementById("size-block");
const denoiseBlock = document.getElementById("denoise-block");
const imageInput = document.getElementById("image");
const preview = document.getElementById("preview");
const uploadPlaceholder = document.getElementById("upload-placeholder");
const clearImageBtn = document.getElementById("clear-image");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnSpinner = document.getElementById("btn-spinner");
const regenerateBtn = document.getElementById("regenerate-btn");
const statusEl = document.getElementById("status");
const connectionBadge = document.getElementById("connection-badge");
const connectionDetail = document.getElementById("connection-detail");
const outputEmpty = document.getElementById("output-empty");
const outputLoading = document.getElementById("output-loading");
const outputResult = document.getElementById("output-result");
const resultImage = document.getElementById("result-image");
const resultMeta = document.getElementById("result-meta");
const elapsedEl = document.getElementById("elapsed");
const downloadLink = document.getElementById("download-link");
const copySeedBtn = document.getElementById("copy-seed");
const seedInput = document.getElementById("seed");
const denoiseInput = document.getElementById("denoise");
const denoiseValue = document.getElementById("denoise-value");
const presetSelect = document.getElementById("preset-select");
const randomSeedBtn = document.getElementById("random-seed");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const historyBlock = document.getElementById("history-block");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history");

let currentMode = "txt2img";
let previewUrl = null;
let lastSeed = null;
let lastResultUrl = null;
let history = [];
let elapsedTimer = null;
let comfyuiConnected = false;

function setMode(mode) {
  currentMode = mode;
  const img2img = mode === "img2img";

  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  imageBlock.classList.toggle("hidden", !img2img);
  sizeBlock.classList.toggle("hidden", img2img);
  denoiseBlock.classList.toggle("hidden", !img2img);

  if (!img2img) {
    clearImage();
  }
}

function setPreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (!file) {
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    uploadPlaceholder.classList.remove("hidden");
    clearImageBtn.classList.add("hidden");
    return;
  }

  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.classList.remove("hidden");
  uploadPlaceholder.classList.add("hidden");
  clearImageBtn.classList.remove("hidden");
}

function clearImage() {
  imageInput.value = "";
  setPreview(null);
}

function setLoading(active) {
  submitBtn.disabled = active || !comfyuiConnected;
  regenerateBtn.disabled = active || lastSeed === null;
  btnSpinner.classList.toggle("hidden", !active);
  btnText.textContent = active ? "Generating…" : "Generate";

  if (active) {
    outputEmpty.classList.add("hidden");
    outputResult.classList.add("hidden");
    outputLoading.classList.remove("hidden");
  } else {
    outputLoading.classList.add("hidden");
  }
}

function startElapsedTimer() {
  const start = Date.now();
  elapsedEl.textContent = "0s";
  elapsedTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - start) / 1000);
    elapsedEl.textContent = `${seconds}s`;
  }, 1000);
}

function stopElapsedTimer() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

async function parseError(response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data.detail) {
      return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    }
  } catch {
    // plain text error
  }
  return text || `Request failed (${response.status})`;
}

function showResult({ url, seed, mode, prompt, seconds }) {
  lastResultUrl = url;
  lastSeed = seed;

  outputEmpty.classList.add("hidden");
  outputLoading.classList.add("hidden");
  outputResult.classList.remove("hidden");

  resultImage.src = url;
  resultMeta.textContent = `${mode === "img2img" ? "Image to Image" : "Text to Image"} · Seed ${seed} · ${seconds.toFixed(1)}s`;

  downloadLink.href = url;
  downloadLink.classList.remove("hidden");
  copySeedBtn.classList.remove("hidden");
  regenerateBtn.disabled = false;
  seedInput.value = seed;
}

function renderHistory() {
  if (!history.length) {
    historyBlock.classList.add("hidden");
    historyList.innerHTML = "";
    return;
  }

  historyBlock.classList.remove("hidden");
  historyList.innerHTML = "";

  history.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.title = item.prompt;
    btn.innerHTML = `<img src="${item.url}" alt="History ${index + 1}" />`;
    btn.addEventListener("click", () => showResult(item));
    historyList.appendChild(btn);
  });
}

function addHistory(item) {
  history.unshift(item);
  if (history.length > 12) {
    const removed = history.pop();
    if (removed?.url) {
      URL.revokeObjectURL(removed.url);
    }
  }
  renderHistory();
}

async function checkHealth() {
  connectionBadge.className = "badge wait";
  connectionBadge.textContent = "Checking…";

  try {
    const response = await fetch("/health", { cache: "no-store" });
    const data = await response.json();
    comfyuiConnected = Boolean(data.comfyui_connected);

    const version = data.version ? ` · v${data.version}` : "";

    if (data.comfyui_connected) {
      connectionBadge.className = "badge ok";
      connectionBadge.textContent = "ComfyUI connected";
      connectionDetail.textContent = `${data.comfyui_url}${version}`;
      submitBtn.disabled = false;
    } else {
      connectionBadge.className = "badge err";
      connectionBadge.textContent = "ComfyUI offline";
      connectionDetail.textContent = data.comfyui_error
        ? `${data.comfyui_url}${version} — ${data.comfyui_error}`
        : `${data.comfyui_url}${version}`;
      submitBtn.disabled = true;
      statusEl.textContent = "Start ComfyUI on port 8188 on the GPU server, then click Generate.";
      statusEl.classList.add("error");
    }
  } catch {
    comfyuiConnected = false;
    connectionBadge.className = "badge err";
    connectionBadge.textContent = "Server unreachable";
    connectionDetail.textContent = "Cannot reach the Z Image Turbo API on port 8189.";
    submitBtn.disabled = true;
  }
}

async function runGeneration(reuseSeed = false) {
  statusEl.classList.remove("error");

  if (!comfyuiConnected) {
    await checkHealth();
    if (!comfyuiConnected) {
      statusEl.textContent = "ComfyUI is offline. Start it on the GPU server at port 8188.";
      statusEl.classList.add("error");
      return;
    }
  }

  if (currentMode === "img2img" && !imageInput.files?.[0]) {
    statusEl.textContent = "Upload a source image for Image to Image mode.";
    statusEl.classList.add("error");
    return;
  }

  const started = performance.now();
  setLoading(true);
  startElapsedTimer();
  statusEl.textContent = "Sending job to ComfyUI on the GPU server…";

  const formData = new FormData(form);

  if (currentMode === "txt2img") {
    formData.delete("image");
  }

  if (!formData.get("seed")) {
    formData.delete("seed");
  } else if (reuseSeed && lastSeed !== null) {
    formData.set("seed", String(lastSeed));
  }

  try {
    const response = await fetch("/generate", { method: "POST", body: formData });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const seconds = (performance.now() - started) / 1000;
    const seed = response.headers.get("X-Seed");
    const mode = response.headers.get("X-Mode") || currentMode;
    const prompt = formData.get("prompt") || "";

    const item = { url, seed, mode, prompt, seconds };
    showResult(item);
    addHistory(item);
    statusEl.textContent = `Done in ${seconds.toFixed(1)}s.`;
  } catch (error) {
    outputResult.classList.add("hidden");
    outputEmpty.classList.remove("hidden");
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  } finally {
    stopElapsedTimer();
    setLoading(false);
  }
}

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

imageInput.addEventListener("change", () => {
  setPreview(imageInput.files?.[0] || null);
});

clearImageBtn.addEventListener("click", (event) => {
  event.preventDefault();
  clearImage();
});

presetSelect.addEventListener("change", () => {
  if (presetSelect.value) {
    document.getElementById("prompt").value = presetSelect.value;
    presetSelect.value = "";
  }
});

randomSeedBtn.addEventListener("click", () => {
  seedInput.value = Math.floor(Math.random() * 2 ** 31);
});

copySeedBtn.addEventListener("click", async () => {
  if (!seedInput.value) return;
  try {
    await navigator.clipboard.writeText(seedInput.value);
    statusEl.textContent = "Seed copied.";
  } catch {
    statusEl.textContent = "Could not copy seed.";
  }
});

denoiseInput.addEventListener("input", () => {
  denoiseValue.textContent = Number(denoiseInput.value).toFixed(2);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    widthInput.value = chip.dataset.w;
    heightInput.value = chip.dataset.h;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runGeneration(false);
});

regenerateBtn.addEventListener("click", () => runGeneration(true));

clearHistoryBtn.addEventListener("click", () => {
  history.forEach((item) => URL.revokeObjectURL(item.url));
  history = [];
  renderHistory();
});

setMode("txt2img");
denoiseValue.textContent = Number(denoiseInput.value).toFixed(2);
checkHealth();
setInterval(checkHealth, 30000);
