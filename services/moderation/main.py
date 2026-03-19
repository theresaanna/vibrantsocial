import os
import io
import logging
from contextlib import asynccontextmanager

import requests
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from PIL import Image
from transformers import pipeline
from detoxify import Detoxify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("moderation")

MODERATION_API_KEY = os.environ.get("MODERATION_API_KEY", "")

nsfw_classifier = None
toxicity_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global nsfw_classifier, toxicity_model
    nsfw_classifier = pipeline(
        "image-classification",
        model="Falconsai/nsfw_image_detection",
    )
    toxicity_model = Detoxify("original")
    yield


app = FastAPI(title="VibrantSocial Moderation Service", lifespan=lifespan)

NSFW_THRESHOLD = float(os.environ.get("NSFW_THRESHOLD", "0.7"))
TOXICITY_THRESHOLD = float(os.environ.get("TOXICITY_THRESHOLD", "0.7"))
IDENTITY_ATTACK_THRESHOLD = float(os.environ.get("IDENTITY_ATTACK_THRESHOLD", "0.5"))
INSULT_THRESHOLD = float(os.environ.get("INSULT_THRESHOLD", "0.7"))


def verify_api_key(x_api_key: str = Header(alias="X-API-Key")):
    if not MODERATION_API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
    if x_api_key != MODERATION_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class ImageScanRequest(BaseModel):
    url: str


class ImageScanResponse(BaseModel):
    nsfw: bool
    score: float
    label: str


class TextScanRequest(BaseModel):
    text: str


class TextScanResponse(BaseModel):
    toxicity: float
    severe_toxicity: float
    obscenity: float
    insult: float
    threat: float
    identity_attack: float
    is_hate_speech: bool
    is_bullying: bool


@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": nsfw_classifier is not None}


@app.post("/scan/image", response_model=ImageScanResponse)
async def scan_image(
    req: ImageScanRequest,
    x_api_key: str = Header(alias="X-API-Key"),
):
    verify_api_key(x_api_key)

    try:
        resp = requests.get(req.url, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {e}")

    try:
        image = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    results = nsfw_classifier(image)

    nsfw_score = 0.0
    label = "normal"
    for result in results:
        if result["label"] == "nsfw":
            nsfw_score = result["score"]
            if nsfw_score >= NSFW_THRESHOLD:
                label = "nsfw"
            break

    is_nsfw = nsfw_score >= NSFW_THRESHOLD
    if is_nsfw:
        logger.info("NSFW detected: url=%s score=%.4f", req.url, nsfw_score)

    return ImageScanResponse(
        nsfw=is_nsfw,
        score=round(nsfw_score, 4),
        label=label,
    )


@app.post("/scan/text", response_model=TextScanResponse)
async def scan_text(
    req: TextScanRequest,
    x_api_key: str = Header(alias="X-API-Key"),
):
    verify_api_key(x_api_key)

    if not req.text or not req.text.strip():
        return TextScanResponse(
            toxicity=0.0,
            severe_toxicity=0.0,
            obscenity=0.0,
            insult=0.0,
            threat=0.0,
            identity_attack=0.0,
            is_hate_speech=False,
            is_bullying=False,
        )

    scores = toxicity_model.predict(req.text)

    toxicity = float(scores["toxicity"])
    severe_toxicity = float(scores["severe_toxicity"])
    obscenity = float(scores["obscenity"])
    insult = float(scores["insult"])
    threat = float(scores["threat"])
    identity_attack = float(scores["identity_attack"])

    is_hate_speech = (
        identity_attack >= IDENTITY_ATTACK_THRESHOLD
        or severe_toxicity >= TOXICITY_THRESHOLD
    )
    is_bullying = (
        insult >= INSULT_THRESHOLD
        or (toxicity >= TOXICITY_THRESHOLD and threat >= 0.3)
    )

    if is_hate_speech:
        logger.info(
            "Hate speech detected: identity_attack=%.4f severe_toxicity=%.4f text=%s",
            identity_attack, severe_toxicity, req.text[:200],
        )
    if is_bullying:
        logger.info(
            "Bullying detected: insult=%.4f toxicity=%.4f threat=%.4f text=%s",
            insult, toxicity, threat, req.text[:200],
        )

    return TextScanResponse(
        toxicity=round(toxicity, 4),
        severe_toxicity=round(severe_toxicity, 4),
        obscenity=round(obscenity, 4),
        insult=round(insult, 4),
        threat=round(threat, 4),
        identity_attack=round(identity_attack, 4),
        is_hate_speech=is_hate_speech,
        is_bullying=is_bullying,
    )
