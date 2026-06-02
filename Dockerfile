FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    COMFYUI_URL=http://127.0.0.1:8188

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py comfy_client.py workflow_img2img.json workflow_txt2img.json ./
COPY static ./static

EXPOSE 8189

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8189"]
