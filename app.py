import os
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from comfy_client import COMFYUI_URL, generate_image

BRAND = {
    "studio": "Binyan Studios",
    "product": "Z Image Turbo",
    "tagline": "AI image generation powered by ComfyUI",
}

app = FastAPI(title=f"{BRAND['studio']} — {BRAND['product']}")
STATIC_DIR = Path(__file__).parent / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")


@app.get("/health")
async def health():
    comfyui_ok = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{os.getenv('COMFYUI_URL', COMFYUI_URL)}/system_stats")
            comfyui_ok = response.status_code == 200
    except httpx.HTTPError:
        comfyui_ok = False

    return {
        "status": "ok",
        "brand": BRAND,
        "comfyui_url": os.getenv("COMFYUI_URL", COMFYUI_URL),
        "comfyui_connected": comfyui_ok,
    }


@app.post("/generate")
async def generate(
    prompt: str = Form(...),
    image: UploadFile | None = File(None),
    seed: int | None = Form(None),
    steps: int = Form(8),
    cfg: float = Form(1.0),
    denoise: float = Form(0.75),
    width: int = Form(1024),
    height: int = Form(1024),
):
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")

    if width < 256 or height < 256 or width > 2048 or height > 2048:
        raise HTTPException(status_code=400, detail="Width and height must be between 256 and 2048.")

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
            width=width,
            height=height,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    mode = "img2img" if image_bytes else "txt2img"
    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={
            "X-Seed": str(used_seed),
            "X-Mode": mode,
            "X-Prompt": prompt.strip()[:200],
        },
    )
