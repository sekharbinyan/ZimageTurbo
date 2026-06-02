# ZimageTurbo

Web interface for the Z Image Turbo ComfyUI workflow. Upload an image, enter a prompt, and receive the generated result.

## Prerequisites

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running locally on port **8188**
- Required models in ComfyUI:
  - `z_image_turbo_bf16.safetensors`
  - `qwen_3_4b.safetensors`
  - `ae.safetensors`

## Run with Docker (recommended)

1. Start ComfyUI on your machine at `http://localhost:8188`
2. Build and start the interface:

```bash
docker compose up --build
```

3. Open [http://localhost:8189](http://localhost:8189)

The container connects to ComfyUI on the host via `http://host.docker.internal:8188`.

To use a different ComfyUI URL:

```bash
COMFYUI_URL=http://192.168.1.10:8188 docker compose up --build
```

## Run locally (without Docker)

```bash
pip install -r requirements.txt
set COMFYUI_URL=http://127.0.0.1:8188
uvicorn app:app --reload --port 8189
```

## API

```bash
curl -X POST "http://localhost:8189/generate" ^
  -F "prompt=Your prompt here" ^
  -F "image=@input.png" ^
  -F "steps=8" ^
  -F "denoise=0.75" ^
  --output result.png
```

Health check: `GET /health`
