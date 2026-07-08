const form = document.querySelector("[data-media-assistant-form]");
const fileInput = form?.elements.image;
const preview = document.querySelector("[data-media-preview]");
const previewEmpty = document.querySelector("[data-media-empty]");
const statusNode = document.querySelector("[data-media-status]");
const results = document.querySelector("[data-media-results]");

const setStatus = (message, state = "") => {
  statusNode.textContent = message;
  statusNode.dataset.state = state;
};

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  const dataUrl = await readFile(file);
  preview.src = dataUrl;
  preview.hidden = false;
  previewEmpty.hidden = true;
  results.hidden = true;
  setStatus("");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files?.[0];

  if (!file) {
    setStatus("Choose an image first.", "error");
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    setStatus("Choose an image smaller than 3 MB.", "error");
    return;
  }

  setStatus("Analyzing the image...", "loading");
  form.querySelector("button").disabled = true;

  try {
    const dataUrl = await readFile(file);
    const imageData = dataUrl.split(",")[1];
    const response = await fetch("/api/media-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Media-Assistant-Token": form.elements.accessToken.value,
      },
      body: JSON.stringify({
        imageData,
        mimeType: file.type,
        originalName: file.name,
        placement: form.elements.placement.value,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Image analysis failed.");
    }

    Object.entries(payload.analysis || {}).forEach(([key, value]) => {
      const node = document.querySelector(`[data-media-result="${key}"]`);
      if (node) {
        node.textContent = value;
      }
    });

    results.hidden = false;
    setStatus("Analysis complete.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    form.querySelector("button").disabled = false;
  }
});
