import os
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from comfy_client import COMFYUI_URL, generate_image

app = FastAPI(title="Z Image Turbo UI")
STATIC_DIR = Path(__file__).parent / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")


@app.get("/health")
async def health():
    return {"status": "ok", "comfyui_url": os.getenv("COMFYUI_URL", COMFYUI_URL)}


@app.post("/generate")
async def generate(
    prompt: str = Form(...),
    image: UploadFile | None = File(None),
    seed: int | None = Form(None),
    steps: int = Form(8),
    cfg: float = Form(1.0),
    denoise: float = Form(0.75),
):
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    image_bytes = None
    filename = "input.png"
    if image and image.filename:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        filename = image.filename

    try:
        result_bytes, used_seed = generate_image(
            image_bytes=image_bytes,
            filename=filename,
            prompt=prompt.strip(),
            seed=seed,
            steps=steps,
            cfg=cfg,
            denoise=denoise if image_bytes else 1.0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={"X-Seed": str(used_seed)},
    )
