import copy
import json
import os
import random
import time
import uuid
from pathlib import Path

import httpx

BASE_DIR = Path(__file__).parent
COMFYUI_URL = os.getenv("COMFYUI_URL", "http://127.0.0.1:8188")
POLL_INTERVAL = 0.5
TIMEOUT_SECONDS = 600


def load_workflow(name: str) -> dict:
    path = BASE_DIR / name
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def upload_image(client: httpx.Client, image_bytes: bytes, filename: str) -> str:
    files = {"image": (filename, image_bytes, "application/octet-stream")}
    data = {"overwrite": "true"}
    response = client.post(f"{COMFYUI_URL}/upload/image", files=files, data=data)
    response.raise_for_status()
    return response.json()["name"]


def build_prompt(
    workflow: dict,
    *,
    prompt: str,
    seed: int | None,
    steps: int,
    cfg: float,
    denoise: float,
    input_filename: str | None = None,
) -> dict:
    graph = copy.deepcopy(workflow)
    graph["57:27"]["inputs"]["text"] = prompt
    graph["57:3"]["inputs"]["seed"] = seed if seed is not None else random.randint(0, 2**63 - 1)
    graph["57:3"]["inputs"]["steps"] = steps
    graph["57:3"]["inputs"]["cfg"] = cfg
    graph["57:3"]["inputs"]["denoise"] = denoise

    if input_filename is not None:
        graph["10"]["inputs"]["image"] = input_filename

    return graph


def queue_prompt(client: httpx.Client, workflow: dict) -> str:
    payload = {"prompt": workflow, "client_id": str(uuid.uuid4())}
    response = client.post(f"{COMFYUI_URL}/prompt", json=payload)
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise RuntimeError(body["error"])
    if body.get("node_errors"):
        raise RuntimeError(json.dumps(body["node_errors"], indent=2))
    return body["prompt_id"]


def wait_for_result(client: httpx.Client, prompt_id: str) -> list[dict]:
    deadline = time.time() + TIMEOUT_SECONDS
    while time.time() < deadline:
        response = client.get(f"{COMFYUI_URL}/history/{prompt_id}")
        response.raise_for_status()
        history = response.json()
        if prompt_id in history:
            outputs = history[prompt_id].get("outputs", {})
            images = []
            for node_output in outputs.values():
                for image in node_output.get("images", []):
                    images.append(image)
            if images:
                return images
            raise RuntimeError("Generation finished but no images were returned.")
        time.sleep(POLL_INTERVAL)
    raise TimeoutError("Timed out waiting for ComfyUI to finish.")


def fetch_image(client: httpx.Client, image_info: dict) -> bytes:
    params = {
        "filename": image_info["filename"],
        "subfolder": image_info.get("subfolder", ""),
        "type": image_info.get("type", "output"),
    }
    response = client.get(f"{COMFYUI_URL}/view", params=params)
    response.raise_for_status()
    return response.content


def generate_image(
    *,
    image_bytes: bytes | None,
    filename: str,
    prompt: str,
    seed: int | None,
    steps: int,
    cfg: float,
    denoise: float,
) -> tuple[bytes, int]:
    workflow_name = "workflow_img2img.json" if image_bytes else "workflow_txt2img.json"
    workflow = load_workflow(workflow_name)

    with httpx.Client(timeout=120.0) as client:
        input_filename = None
        if image_bytes:
            input_filename = upload_image(client, image_bytes, filename)

        graph = build_prompt(
            workflow,
            prompt=prompt,
            seed=seed,
            steps=steps,
            cfg=cfg,
            denoise=denoise,
            input_filename=input_filename,
        )
        prompt_id = queue_prompt(client, graph)
        images = wait_for_result(client, prompt_id)
        result_bytes = fetch_image(client, images[0])
        used_seed = graph["57:3"]["inputs"]["seed"]
        return result_bytes, used_seed
