# ZimageTurbo

**Binyan Studios** web interface for the Z Image Turbo ComfyUI workflow.

Designed to run on a **remote GPU server** where ComfyUI and this UI live on the same machine.

## Architecture

| Service | Port | Who accesses it |
|---------|------|-----------------|
| ComfyUI | **8188** | Internal only (same server) |
| Z Image Turbo UI | **8189** | Your browser → `http://YOUR_GPU_SERVER:8189` |

The UI talks to ComfyUI at `http://127.0.0.1:8188` on the GPU server. You open port **8189** in your firewall/security group.

## Prerequisites (on the GPU server)

- ComfyUI running on port **8188**
- Docker + Docker Compose
- Models in ComfyUI:
  - `z_image_turbo_bf16.safetensors`
  - `qwen_3_4b.safetensors`
  - `ae.safetensors`

## Deploy on remote GPU server

```bash
git clone https://github.com/sekharbinyan/ZimageTurbo.git
cd ZimageTurbo
cp .env.example .env
chmod +x deploy.sh
./deploy.sh
```

Or manually:

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

Open in your browser:

```
http://YOUR_GPU_SERVER_IP:8189
```

Verify you have the latest build:

```bash
curl http://127.0.0.1:8189/health
```

Look for `"version": "2026-06-02-remote-1"` and `"comfyui_connected": true`.

### ComfyUI must be running first

On the **same GPU server**, start ComfyUI before the UI:

```bash
# Example — adjust to your ComfyUI install path
python main.py --listen 0.0.0.0 --port 8188
```

If ComfyUI shows offline, the UI cannot generate images.

### ComfyUI on a different address

Edit `.env` on the server:

```env
COMFYUI_URL=http://10.0.0.5:8188
```

Then restart:

```bash
docker compose up --build -d
```

## Health check

```bash
curl http://YOUR_GPU_SERVER_IP:8189/health
```

Should show `"comfyui_connected": true` when ComfyUI is reachable from the container.

## API

```bash
curl -X POST "http://YOUR_GPU_SERVER_IP:8189/generate" \
  -F "prompt=Your prompt here" \
  -F "image=@input.png" \
  -F "steps=8" \
  -F "denoise=0.75" \
  --output result.png
```

## Run without Docker (on the GPU server)

```bash
pip install -r requirements.txt
export COMFYUI_URL=http://127.0.0.1:8188
uvicorn app:app --host 0.0.0.0 --port 8189
```
