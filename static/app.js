const form = document.getElementById("generate-form");
const imageInput = document.getElementById("image");
const imageSection = document.getElementById("image-section");
const sizeSection = document.getElementById("size-section");
const denoiseField = document.getElementById("denoise-field");
const dropzone = document.getElementById("dropzone");
const dropzonePlaceholder = document.getElementById("dropzone-placeholder");
const preview = document.getElementById("preview");
const clearImageBtn = document.getElementById("clear-image");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");
const btnLabel = submitBtn.querySelector(".btn-label");
const spinner = submitBtn.querySelector(".spinner");
const regenerateBtn = document.getElementById("regenerate-btn");
const resultImg = document.getElementById("result");
const resultEmpty = document.getElementById("result-empty");
const resultView = document.getElementById("result-view");
const compareView = document.getElementById("compare-view");
const compareInput = document.getElementById("compare-input");
const compareOutput = document.getElementById("compare-output");
const metaBar = document.getElementById("meta-bar");
const seedInfo = document.getElementById("seed-info");
const modeInfo = document.getElementById("mode-info");
const timeInfo = document.getElementById("time-info");
const downloadLink = document.getElementById("download-link");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const fullscreenDialog = document.getElementById("fullscreen-dialog");
const fullscreenImage = document.getElementById("fullscreen-image");
const closeFullscreen = document.getElementById("close-fullscreen");
const connectionBadge = document.getElementById("connection-badge");
const modeTabs = document.querySelectorAll(".mode-tab");
const presetSelect = document.getElementById("preset-select");
const randomSeedBtn = document.getElementById("random-seed");
const copySeedBtn = document.getElementById("copy-seed");
const seedInput = document.getElementById("seed");
const denoiseInput = document.getElementById("denoise");
const denoiseValue = document.getElementById("denoise-value");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const sizeChips = document.querySelectorAll(".chip");
const historyGrid = document.getElementById("history-grid");
const clearHistoryBtn = document.getElementById("clear-history");

let currentMode = "txt2img";
let lastSeed = null;
let lastPrompt = null;
let lastResultUrl = null;
let previewUrl = null;
let sessionHistory = [];

function setMode(mode) {
  currentMode = mode;
  modeTabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  const isImg2Img = mode === "img2img";
  imageSection.classList.toggle("hidden", !isImg2Img);
  sizeSection.classList.toggle("hidden", isImg2Img);
  denoiseField.classList.toggle("hidden", !isImg2Img);

  if (!isImg2Img) {
    clearImage();
  }
}

function setPreview(file) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    dropzonePlaceholder.hidden = false;
    clearImageBtn.hidden = true;
    return;
  }

  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.hidden = false;
  dropzonePlaceholder.hidden = true;
  clearImageBtn.hidden = false;
}

function clearImage() {
  imageInput.value = "";
  setPreview(null);
}

function randomSeed() {
  const value = Math.floor(Math.random() * 2 ** 31);
  seedInput.value = value;
  return value;
}

function updateConnectionBadge(connected) {
  connectionBadge.classList.remove("badge-checking", "badge-online", "badge-offline");
  if (connected) {
    connectionBadge.textContent = "ComfyUI connected";
    connectionBadge.classList.add("badge-online");
  } else {
    connectionBadge.textContent = "ComfyUI offline";
    connectionBadge.classList.add("badge-offline");
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();
    updateConnectionBadge(data.comfyui_connected);
  } catch {
    updateConnectionBadge(false);
  }
}

function setLoading(isLoading, message = "") {
  submitBtn.disabled = isLoading;
  regenerateBtn.disabled = isLoading || !lastSeed;
  spinner.hidden = !isLoading;
  btnLabel.textContent = isLoading ? "Generating…" : "Generate";
  if (message) {
    statusEl.textContent = message;
  }
}

function renderHistory() {
  if (!sessionHistory.length) {
    historyGrid.innerHTML = '<p class="history-empty">No generations yet.</p>';
    return;
  }

  historyGrid.innerHTML = "";
  sessionHistory.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "history-item";
    card.innerHTML = `
      <img src="${item.url}" alt="History item" />
      <div class="history-item-meta">${item.prompt.slice(0, 40)}</div>
    `;
    card.addEventListener("click", () => showResult(item));
    historyGrid.appendChild(card);
  });
}

function showResult({ url, seed, mode, prompt, elapsed, inputUrl }) {
  lastResultUrl = url;
  lastSeed = seed;
  lastPrompt = prompt;

  resultEmpty.hidden = true;
  resultImg.hidden = false;
  resultImg.src = url;
  downloadLink.href = url;
  downloadLink.hidden = false;
  fullscreenBtn.hidden = false;
  regenerateBtn.disabled = false;

  const showCompare = mode === "img2img" && inputUrl;
  compareView.classList.toggle("hidden", !showCompare);
  resultView.classList.toggle("hidden", showCompare);

  if (showCompare) {
    compareInput.src = inputUrl;
    compareOutput.src = url;
  }

  seedInfo.textContent = `Seed ${seed}`;
  modeInfo.textContent = mode === "img2img" ? "Image to Image" : "Text to Image";
  timeInfo.textContent = `${elapsed.toFixed(1)}s`;
  metaBar.hidden = false;

  seedInput.value = seed;
  copySeedBtn.hidden = false;
}

function addToHistory(entry) {
  sessionHistory.unshift(entry);
  if (sessionHistory.length > 16) {
    const removed = sessionHistory.pop();
    if (removed?.url) {
      URL.revokeObjectURL(removed.url);
    }
  }
  renderHistory();
}

async function runGeneration(useLastSeed = false) {
  statusEl.classList.remove("error");

  if (currentMode === "img2img" && !imageInput.files?.[0]) {
    statusEl.textContent = "Please upload a source image for Image to Image mode.";
    statusEl.classList.add("error");
    return;
  }

  const started = performance.now();
  setLoading(true, "Sending to ComfyUI…");

  const formData = new FormData(form);
  if (currentMode === "txt2img") {
    formData.delete("image");
  }

  if (!formData.get("seed")) {
    formData.delete("seed");
  } else if (useLastSeed && lastSeed !== null) {
    formData.set("seed", String(lastSeed));
  }

  try {
    const response = await fetch("/generate", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Generation failed.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const elapsed = (performance.now() - started) / 1000;
    const seed = response.headers.get("X-Seed");
    const mode = response.headers.get("X-Mode") || currentMode;
    const prompt = formData.get("prompt") || "";

    showResult({
      url: objectUrl,
      seed,
      mode,
      prompt,
      elapsed,
      inputUrl: previewUrl,
    });

    addToHistory({
      url: objectUrl,
      seed,
      mode,
      prompt,
      elapsed,
      inputUrl: previewUrl,
    });

    statusEl.textContent = `Done in ${elapsed.toFixed(1)}s.`;
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  } finally {
    setLoading(false);
  }
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer.files?.[0];
  if (file && file.type.startsWith("image/")) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    imageInput.files = transfer.files;
    setPreview(file);
  }
});

imageInput.addEventListener("change", () => {
  setPreview(imageInput.files?.[0] || null);
});

clearImageBtn.addEventListener("click", clearImage);

presetSelect.addEventListener("change", () => {
  if (presetSelect.value) {
    document.getElementById("prompt").value = presetSelect.value;
    presetSelect.value = "";
  }
});

randomSeedBtn.addEventListener("click", randomSeed);

copySeedBtn.addEventListener("click", async () => {
  if (!seedInput.value) return;
  await navigator.clipboard.writeText(seedInput.value);
  statusEl.textContent = "Seed copied to clipboard.";
});

denoiseInput.addEventListener("input", () => {
  denoiseValue.textContent = Number(denoiseInput.value).toFixed(2);
});

sizeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    widthInput.value = chip.dataset.w;
    heightInput.value = chip.dataset.h;
    sizeChips.forEach((c) => c.classList.toggle("active", c === chip));
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runGeneration(false);
});

regenerateBtn.addEventListener("click", async () => {
  if (lastSeed !== null) {
    seedInput.value = lastSeed;
  }
  await runGeneration(true);
});

fullscreenBtn.addEventListener("click", () => {
  if (!lastResultUrl) return;
  fullscreenImage.src = lastResultUrl;
  fullscreenDialog.showModal();
});

closeFullscreen.addEventListener("click", () => fullscreenDialog.close());
fullscreenDialog.addEventListener("click", (event) => {
  if (event.target === fullscreenDialog) {
    fullscreenDialog.close();
  }
});

clearHistoryBtn.addEventListener("click", () => {
  sessionHistory.forEach((item) => URL.revokeObjectURL(item.url));
  sessionHistory = [];
  renderHistory();
});

setMode("txt2img");
denoiseValue.textContent = Number(denoiseInput.value).toFixed(2);
checkHealth();
setInterval(checkHealth, 30000);
