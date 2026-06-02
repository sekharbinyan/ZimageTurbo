import os
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from comfy_client import check_comfyui, generate_image, get_comfyui_url

BUILD_VERSION = "2026-06-02-remote-1"

BRAND = {
    "studio": "Binyan Studios",
    "product": "Z Image Turbo",
    "tagline": "AI image generation powered by ComfyUI",
}

app = FastAPI(title=f"{BRAND['studio']} — {BRAND['product']}")
STATIC_DIR = Path(__file__).parent / "static"


class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path == "/" or path.startswith("/static/") or path == "/health":
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response


app.add_middleware(NoCacheMiddleware)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
async def startup():
    url = get_comfyui_url()
    ok, error = check_comfyui()
    if ok:
        print(f"[startup] ComfyUI reachable at {url}")
    else:
        print(f"[startup] WARNING: ComfyUI not reachable at {url}: {error}")


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store"})


@app.get("/health")
async def health():
    url = get_comfyui_url()
    comfyui_ok, error = check_comfyui()

    return {
        "status": "ok",
        "version": BUILD_VERSION,
        "brand": BRAND,
        "comfyui_url": url,
        "comfyui_connected": comfyui_ok,
        "comfyui_error": error,
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

    comfyui_ok, comfyui_error = check_comfyui()
    if not comfyui_ok:
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    f"ComfyUI is not reachable at {get_comfyui_url()}. "
                    f"Start ComfyUI on port 8188 or set COMFYUI_URL. Error: {comfyui_error}"
                )
            },
        )

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
    except TimeoutError:
        return JSONResponse(
            status_code=504,
            content={"detail": "Generation timed out. ComfyUI may still be loading models — try again."},
        )
    except httpx.HTTPError as exc:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Cannot reach ComfyUI at {get_comfyui_url()}: {exc}"},
        )
    except Exception as exc:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    mode = "img2img" if image_bytes else "txt2img"
    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={
            "X-Seed": str(used_seed),
            "X-Mode": mode,
        },
    )
