const form = document.getElementById("generate-form");
const imageInput = document.getElementById("image");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");
const resultImg = document.getElementById("result");
const resultEmpty = document.getElementById("result-empty");
const seedInfo = document.getElementById("seed-info");
const downloadLink = document.getElementById("download-link");

function setPreview(file) {
  if (!file) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.style.borderColor = "#6ea8ff";
});

dropzone.addEventListener("dragleave", () => {
  dropzone.style.borderColor = "";
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.style.borderColor = "";
  const file = event.dataTransfer.files?.[0];
  if (file && file.type.startsWith("image/")) {
    imageInput.files = event.dataTransfer.files;
    setPreview(file);
  }
});

imageInput.addEventListener("change", () => {
  setPreview(imageInput.files?.[0] || null);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Generating...";
  statusEl.classList.remove("error");
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const seedValue = formData.get("seed");
  if (!seedValue) {
    formData.delete("seed");
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
    resultImg.src = objectUrl;
    resultImg.hidden = false;
    resultEmpty.hidden = true;

    downloadLink.href = objectUrl;
    downloadLink.hidden = false;

    const usedSeed = response.headers.get("X-Seed");
    seedInfo.textContent = usedSeed ? `Seed: ${usedSeed}` : "";
    seedInfo.hidden = !usedSeed;
    statusEl.textContent = "Done.";
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
  }
});
