"""
Civic Issue Reporting & Management System - Multimodal AI Microservice
======================================================================

Architecture Overview:
----------------------
This microservice powers the intelligent multimodal AI verification pipeline for the
Civic Hazard Reporting system. It implements a two-stage "Human-in-the-Loop" workflow:

1. Stage 1: Quick Inspection (`POST /preview`)
   - Citizen uploads a photo of a civic hazard.
   - `microsoft/Florence-2-base` inspects the scene using `<MORE_DETAILED_CAPTION>` to
     automatically detect and describe the civic defect.
   - `google/flan-t5-base` translates/summarizes the description into a formal Hindi sentence.
   - `Florence-2-base` phrase grounding (`<CAPTION_TO_PHRASE_GROUNDING>`) localizes the initial
     defect bounding box [x1, y1, x2, y2].
   - Vector embeddings are omitted at this stage to keep the preview fast and responsive.

2. Stage 2: Final Verification & Vector Generation (`POST /submit`)
   - Accepts the image, citizen's final text (either AI-suggested or citizen-edited), and `was_edited` flag.
   - If `was_edited == True`: `google/flan-t5-base` normalizes casual citizen/Hinglish text
     (e.g., "sadak dhas gyi h yaha") into a concise, professional technical English municipal
     hazard title and corresponding formal Hindi description.
   - If `was_edited == False`: Preserves confirmed technical text and its Hindi counterpart.
   - `Florence-2-base` performs visual phrase grounding using the finalized hazard phrase.
   - Computes defect bounding box area coverage percentage and assigns dynamic severity:
     * CRITICAL: Area % >= 25%
     * HIGH:     Area % >= 10%
     * MEDIUM:   Area % >= 3%
     * LOW:      Area % < 3%
   - `sentence-transformers/all-MiniLM-L6-v2` produces a 384-dimensional dense semantic vector
     for geospatial report deduplication and clustering.

Models Used:
------------
1. `microsoft/Florence-2-base` (VLM for detailed captioning and phrase grounding)
2. `google/flan-t5-base` (Seq2Seq NLP pipeline for normalization & translation)
3. `sentence-transformers/all-MiniLM-L6-v2` (Dense semantic embeddings)
"""

import io
import logging
import os
import re
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Tuple

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from transformers import (
    AutoModelForCausalLM,
    AutoProcessor,
    pipeline,
)

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("civic-ai-vlm")

# ---------------------------------------------------------------------------
# Device & Precision Configuration
# ---------------------------------------------------------------------------
if torch.cuda.is_available():
    DEVICE = "cuda"
    TORCH_DTYPE = torch.float16
    DEVICE_ID = 0
    device_name = f"cuda ({torch.cuda.get_device_name(0)})"
    logger.info("CUDA detected. Running models on GPU with float16 precision: %s", device_name)
else:
    DEVICE = "cpu"
    TORCH_DTYPE = torch.float32
    DEVICE_ID = -1
    device_name = "cpu"
    logger.info("CUDA not available. Falling back to CPU with float32 precision.")

# ---------------------------------------------------------------------------
# Global Model Registry & Model IDs
# ---------------------------------------------------------------------------
VLM_MODEL_ID = "microsoft/Florence-2-base"
T5_MODEL_ID = "google/flan-t5-base"
EMBED_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"

MODELS: Dict[str, Any] = {
    "vlm_model": None,
    "vlm_processor": None,
    "t5_pipeline": None,
    "embed_model": None,
}

# ---------------------------------------------------------------------------
# Civic Issue Domain Taxonomy (Bilingual Technical Knowledge Base)
# ---------------------------------------------------------------------------
# Provides high-precision technical mappings for common Indian municipal hazards,
# handling colloquial vernacular / Hinglish terms with government-grade Hindi translations.
def matches_keyword(text: str, keyword: str) -> bool:
    """Checks whether a keyword or phrase exists in text with word boundaries to avoid false positives."""
    pattern = r"\b" + re.escape(keyword.strip().lower()) + r"\b"
    return bool(re.search(pattern, text.lower()))


CIVIC_TAXONOMY = [
    {
        "keywords": ["dhas", "collapse", "cave in", "sinkhole", "dhas gyi", "dhasna", "collapsed road", "dhasa"],
        "grounding_cue": "collapsed road",
        "en": "Collapsed asphalt road causing road hazard",
        "hi": "सड़क का धंसना और गड्ढा",
    },
    {
        "keywords": ["pothole", "gaddha", "gaddhe", "khadda", "crater", "potholes", "deep hole"],
        "grounding_cue": "pothole",
        "en": "A deep pothole on an asphalt road with standing water",
        "hi": "सड़क पर गहरा गड्ढा और जलभराव",
    },
    {
        "keywords": ["crack", "tuti", "tuta", "broken road", "damaged road", "sadak", "pavement", "asphalt", "bad road", "khado"],
        "grounding_cue": "damaged road",
        "en": "cracked and degraded municipal road surface",
        "hi": "क्षतिग्रस्त एवं दरारयुक्त डामर सड़क की सतह",
    },
    {
        "keywords": ["garbage", "kachra", "kooda", "kuda", "trash", "waste", "dump", "gandagi", "litter", "debris", "rubbish", "dustbin"],
        "grounding_cue": "garbage",
        "en": "accumulated municipal solid waste and garbage pile",
        "hi": "सड़क किनारे कचरे और ठोस अपशिष्ट का अनधिकृत ढेर",
    },
    {
        "keywords": ["streetlight", "street light", "batti", "lamp post", "street lamp", "light pole", "khamba", "andhera", "dark street"],
        "grounding_cue": "street light",
        "en": "malfunctioning or broken public street light fixture",
        "hi": "खराब अथवा निष्क्रिय सार्वजनिक मार्ग प्रकाश व्यवस्था (स्ट्रीट लाइट)",
    },
    {
        "keywords": ["water leak", "pani leak", "water pipe", "pipeline", "pipe burst", "burst pipe", "leakage", "flood", "flooding", "waterlogging", "waterlogged", "jalbhavrav"],
        "grounding_cue": "water leak",
        "en": "water supply pipeline leakage causing road inundation",
        "hi": "पेयजल पाइपलाइन का रिसाव एवं सड़क पर जलभराव",
    },
    {
        "keywords": ["manhole", "sewer", "drain", "gutter", "naali", "nali", "dhakkan", "open drain", "chamber"],
        "grounding_cue": "manhole",
        "en": "hazardous open or damaged sewer drainage manhole",
        "hi": "खुला अथवा क्षतिग्रस्त भूमिगत सीवर मैनहोल ढक्कन",
    },
    {
        "keywords": ["tree", "ped", "pedh", "fallen tree", "wire", "taar", "cable", "electric wire", "power line", "electric line", "bijli ka taar"],
        "grounding_cue": "fallen tree",
        "en": "fallen tree branch or hazardous dangling electrical wire",
        "hi": "सड़क पर गिरा हुआ वृक्ष अथवा लटकते खतरनाक बिजली के तार",
    },
]


def _ensure_florence2_compatibility() -> None:
    """
    Patches locally cached Florence-2 Hugging Face files to ensure seamless
    compatibility with modern versions of the `transformers` library:
      1. Fixes `forced_bos_token_id` in configuration_florence2.py
      2. Fixes uninitialized `_supports_sdpa` and `_supports_flash_attn_2` in modeling_florence2.py
      3. Fixes `RobertaTokenizer.additional_special_tokens` and duplicate resize kwargs in processing_florence2.py
    """
    import glob

    cache_dir = os.path.expanduser("~/.cache/huggingface/modules/transformers_modules")
    if not os.path.exists(cache_dir):
        return

    # 1. Patch configuration_florence2.py
    for cf in glob.glob(os.path.join(cache_dir, "**/configuration_florence2.py"), recursive=True):
        try:
            with open(cf, "r", encoding="utf-8") as f:
                content = f.read()
            if "if self.forced_bos_token_id is None" in content:
                content = content.replace(
                    "if self.forced_bos_token_id is None",
                    'if getattr(self, "forced_bos_token_id", None) is None',
                )
                with open(cf, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info("Applied compatibility patch to %s", cf)
        except Exception as patch_err:
            logger.debug("Config patch note: %s", patch_err)

    # 2. Patch modeling_florence2.py
    for mf in glob.glob(os.path.join(cache_dir, "**/modeling_florence2.py"), recursive=True):
        try:
            with open(mf, "r", encoding="utf-8") as f:
                content = f.read()
            modified = False
            sdpa_pattern = re.compile(r"def _supports_sdpa\(self\):[\s\S]*?return self\.language_model\._supports_sdpa")
            if sdpa_pattern.search(content):
                content = sdpa_pattern.sub(
                    'def _supports_sdpa(self):\n        return getattr(self, "language_model", None) is not None and getattr(self.language_model, "_supports_sdpa", False)',
                    content,
                )
                modified = True
            flash_pattern = re.compile(r"def _supports_flash_attn_2\(self\):[\s\S]*?return self\.language_model\._supports_flash_attn_2")
            if flash_pattern.search(content):
                content = flash_pattern.sub(
                    'def _supports_flash_attn_2(self):\n        return getattr(self, "language_model", None) is not None and getattr(self.language_model, "_supports_flash_attn_2", False)',
                    content,
                )
                modified = True
            if modified:
                with open(mf, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info("Applied compatibility patch to %s", mf)
        except Exception as patch_err:
            logger.debug("Model patch note: %s", patch_err)

    # 3. Patch processing_florence2.py
    for pf in glob.glob(os.path.join(cache_dir, "**/processing_florence2.py"), recursive=True):
        try:
            with open(pf, "r", encoding="utf-8") as f:
                content = f.read()
            modified = False
            if "tokenizer.additional_special_tokens +" in content:
                content = content.replace(
                    "tokenizer.additional_special_tokens +",
                    "getattr(tokenizer, 'additional_special_tokens', []) +",
                )
                modified = True

            # Ensure square 768x768 resize without duplicate keyword arguments
            if 'size={"height": 768, "width": 768},\n            resample=3,' in content:
                content = content.replace(
                    'size={"height": 768, "width": 768},\n            resample=3,',
                    'size={"height": 768, "width": 768},',
                )
                modified = True
            elif "pixel_values = self.image_processor(\n            images,\n            do_resize=do_resize," in content:
                content = content.replace(
                    "pixel_values = self.image_processor(\n            images,\n            do_resize=do_resize,",
                    'pixel_values = self.image_processor(\n            images,\n            size={"height": 768, "width": 768},\n            do_resize=True,',
                )
                modified = True

            if "resample=resample," in content:
                content = content.replace("resample=resample,", "resample=3 if resample is None else resample,")
                modified = True

            if modified:
                with open(pf, "w", encoding="utf-8") as f:
                    f.write(content)
                logger.info("Applied compatibility patch to %s", pf)
        except Exception as patch_err:
            logger.debug("Processor patch note: %s", patch_err)


# ---------------------------------------------------------------------------
# Application Lifespan (Startup & Teardown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Pre-loads Florence-2, FLAN-T5 (pipeline), and all-MiniLM into memory during startup.
    Ensures models reside on GPU (float16) if available, or gracefully fallback to CPU.
    """
    logger.info("Initializing Civic AI Microservice models...")
    start_time = time.time()

    # Self-healing compatibility patch for Florence-2
    _ensure_florence2_compatibility()

    try:
        # 1. Load Florence-2 Vision-Language Model & Processor
        logger.info("Loading Vision-Language Model: %s onto %s...", VLM_MODEL_ID, DEVICE)
        vlm_model = AutoModelForCausalLM.from_pretrained(
            VLM_MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            trust_remote_code=True,
        ).to(DEVICE)
        vlm_model.eval()

        vlm_processor = AutoProcessor.from_pretrained(
            VLM_MODEL_ID,
            trust_remote_code=True,
        )
        MODELS["vlm_model"] = vlm_model
        MODELS["vlm_processor"] = vlm_processor
        logger.info("Florence-2-base model loaded successfully.")

        # 2. Load FLAN-T5 via Hugging Face pipeline "text2text-generation"
        logger.info("Loading Seq2Seq Pipeline: %s onto %s...", T5_MODEL_ID, DEVICE)
        t5_pipe = pipeline(
            "text2text-generation",
            model=T5_MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            device=DEVICE_ID,
        )
        MODELS["t5_pipeline"] = t5_pipe
        logger.info("google/flan-t5-base pipeline loaded successfully.")

        # 3. Load Sentence Transformer for 384-d semantic embeddings
        logger.info("Loading Sentence Embedding Model: %s onto %s...", EMBED_MODEL_ID, DEVICE)
        embed_model = SentenceTransformer(EMBED_MODEL_ID, device=DEVICE)
        MODELS["embed_model"] = embed_model
        logger.info("all-MiniLM-L6-v2 model loaded successfully.")

        elapsed = time.time() - start_time
        logger.info("All AI models loaded and ready in %.2f seconds.", elapsed)

    except Exception as exc:
        logger.critical("Failed to load models during startup: %s", exc, exc_info=True)
        raise RuntimeError(f"Model initialization failure: {exc}") from exc

    yield

    logger.info("Unloading models and freeing hardware memory...")
    MODELS.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI Application & Middleware Setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Civic Hazard Reporting AI Microservice",
    description=(
        "Production-grade multimodal microservice providing a two-stage Human-in-the-Loop workflow: "
        "Stage 1 (`POST /preview`) for fast visual defect inspection and Hindi translation; "
        "Stage 2 (`POST /submit`) for technical text refinement, defect phrase grounding, "
        "dynamic severity assessment, and 384-d semantic vector generation."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Request & Response Schemas
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str = Field(..., example="healthy")
    service: str = Field(..., example="civic-ai-vlm")
    device: str = Field(..., example="cuda (NVIDIA GeForce RTX 4050 Laptop GPU)")


class ImageDimensions(BaseModel):
    width: int = Field(..., example=1024)
    height: int = Field(..., example=768)


class BilingualIssue(BaseModel):
    en: str = Field(
        ...,
        description="Technical English description or title of the civic hazard",
        example="A deep pothole on an asphalt road with standing water",
    )
    hi: str = Field(
        ...,
        description="Clean, formal Hindi translation or summary of the civic hazard",
        example="सड़क पर गहरा गड्ढा और जलभराव",
    )


class PreviewResponse(BaseModel):
    success: bool = Field(True, example=True)
    defect_type: Optional[BilingualIssue] = Field(
        default=None,
        description="Concise 1-2 word defect issue label (e.g. Garbage, Pothole)",
    )
    suggested_description: BilingualIssue
    bounding_box: List[float] = Field(
        ...,
        description="Initial localized defect bounding box: [x1, y1, x2, y2]",
        example=[120.0, 340.0, 560.0, 780.0],
    )
    image_dimensions: ImageDimensions


class SubmitResponse(BaseModel):
    success: bool = Field(True, example=True)
    was_edited: bool = Field(
        ...,
        description="Indicates whether the citizen modified the AI's suggested text",
        example=True,
    )
    final_issue: BilingualIssue
    bounding_box: List[float] = Field(
        ...,
        description="Finalized visual defect bounding box: [x1, y1, x2, y2]",
        example=[115.0, 330.0, 570.0, 790.0],
    )
    severity: str = Field(
        ...,
        description="Dynamic severity rating: LOW | MEDIUM | HIGH | CRITICAL",
        example="HIGH",
    )
    area_coverage_pct: float = Field(
        ...,
        description="Defect bounding box area relative to total image area (percentage)",
        example=14.25,
    )
    vector_embedding: List[float] = Field(
        ...,
        description="384-dimensional dense semantic vector for deduplication",
    )


# ---------------------------------------------------------------------------
# Core Inference & Helper Functions
# ---------------------------------------------------------------------------
def clean_weather_and_scenery(text: str) -> str:
    """
    Strips out irrelevant weather, sky, lighting, and distant background scenery
    from Florence-2 generated captions so only the actual civic hazard is described.
    """
    if not text:
        return text

    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    cleaned_sentences = []

    fluff_keywords = [
        "sky", "sunny", "sunlight", "sunshine", "cloud", "clouds", "overcast",
        "weather", "afternoon", "morning", "daylight", "sunset", "lighting",
        "trees in the background", "distant trees", "green trees", "foliage",
        "distant buildings", "horizon", "scenery", "scenic", "blue sky", "clear sky"
    ]

    hazard_keywords = [
        "pothole", "hole", "crack", "collapse", "garbage", "trash", "waste", "water",
        "leak", "drain", "sewer", "manhole", "street", "road", "asphalt", "pavement",
        "wire", "tree", "light", "damage", "debris", "flood", "inundat", "crater", "sinkhole"
    ]

    for sent in sentences:
        s = sent.strip()
        if not s:
            continue
        s_lower = s.lower()
        has_fluff = any(fk in s_lower for fk in fluff_keywords)
        has_hazard = any(hk in s_lower for hk in hazard_keywords)

        if not has_fluff:
            cleaned_sentences.append(s)
        elif has_hazard:
            # Contains both hazard and fluff (e.g. "A large pothole on asphalt road under a clear sky.")
            s_clean = re.sub(
                r"(?:under|with|in|on)\s+(?:a\s+)?(?:clear|blue|sunny|cloudy|bright|overcast)?\s*(?:sky|day|weather|lighting|afternoon|morning)[^,.;]*",
                "",
                s,
                flags=re.IGNORECASE,
            )
            s_clean = re.sub(
                r"(?:with|and)\s+(?:green\s+|lush\s+|dry\s+)?trees\s+in\s+the\s+background[^,.;]*",
                "",
                s_clean,
                flags=re.IGNORECASE,
            )
            s_clean = re.sub(r"\s+", " ", s_clean).strip(" ,.-;")
            if s_clean and len(s_clean) > 8:
                if not s_clean.endswith("."):
                    s_clean += "."
                cleaned_sentences.append(s_clean)

    if cleaned_sentences:
        res = " ".join(cleaned_sentences).strip()
        if not res.endswith("."):
            res += "."
        return res

    return sentences[0].strip() if sentences else text


def compute_severity(area_pct: float, defect_text: str = "") -> str:
    """
    Assign dynamic, realistic severity rating based on defect type and localized area coverage:
      - CRITICAL: Structural cave-ins/sinkholes, open deep manholes, fallen live wires,
                  or massive damage covering >= 45% of the frame.
      - HIGH:     Deep waterlogged potholes, active water main bursts, dense hazardous waste,
                  or localized area between 18% and 45%.
      - MEDIUM:   Moderate potholes, regular road cracks, surface asphalt degradation,
                  or localized area between 5% and 18%.
      - LOW:      Minor cosmetic cracks, single litter spots, malfunctioning street lights,
                  or localized area < 5%.
    """
    defect_lower = defect_text.lower() if defect_text else ""

    # 1. Critical Hazard Keywords (inherently high safety risk to life & vehicles)
    if any(k in defect_lower for k in ["collapse", "sinkhole", "cave-in", "dhas", "dangling wire", "open manhole", "deep crater"]):
        return "CRITICAL"

    # 2. High Hazard Keywords
    if any(k in defect_lower for k in ["deep pothole", "burst", "heavy flooding", "inundation", "overflowing sewer"]):
        if area_pct >= 8.0:
            return "HIGH"
        return "MEDIUM"

    # 3. Area coverage based grading
    if area_pct >= 45.0:
        return "CRITICAL"
    elif area_pct >= 18.0:
        return "HIGH"
    elif area_pct >= 5.0:
        return "MEDIUM"
    else:
        return "LOW"


def run_florence_detailed_caption(
    image: Image.Image,
    vlm_model: Any,
    vlm_processor: Any,
) -> str:
    """
    Executes Florence-2 to automatically detect and describe the visual defect in high fidelity,
    focusing on the civic hazard and removing extraneous weather/landscape clutter.
    """
    task_prompt = "<DETAILED_CAPTION>"
    inputs = vlm_processor(text=task_prompt, images=image, return_tensors="pt")
    input_ids = inputs["input_ids"].to(DEVICE)
    pixel_values = inputs["pixel_values"].to(DEVICE, dtype=TORCH_DTYPE)

    with torch.no_grad():
        generated_ids = vlm_model.generate(
            input_ids=input_ids,
            pixel_values=pixel_values,
            max_new_tokens=160,
            do_sample=False,
            num_beams=3,
        )

    generated_text = vlm_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
    parsed_answer = vlm_processor.post_process_generation(
        generated_text,
        task=task_prompt,
        image_size=(image.width, image.height),
    )
    raw_caption = str(parsed_answer.get(task_prompt, "")).strip()

    # Clean out any weather, sky, sunny day, or background trees fluff
    cleaned = clean_weather_and_scenery(raw_caption)
    return cleaned if cleaned else raw_caption


def extract_defect_cue_and_clause(caption: str) -> Tuple[str, str]:
    """
    Extracts the primary defect cue (e.g. 'pothole', 'garbage') and the first
    descriptive clause from a detailed caption for phrase grounding.
    """
    caption_clean = caption.strip()
    caption_lower = caption_clean.lower()

    # 1. Match against domain taxonomy keywords
    for entry in CIVIC_TAXONOMY:
        if any(matches_keyword(caption_lower, kw) for kw in entry["keywords"]):
            return entry["grounding_cue"], entry["grounding_cue"]

    # 2. Extract first grammatical clause
    first_clause = re.split(r"[,;.\n]| with | and | where ", caption_clean, flags=re.IGNORECASE)[0].strip()
    words = first_clause.split()
    if len(words) > 6:
        cue = " ".join(words[:4])
    else:
        cue = first_clause if first_clause else "defect"

    return cue, first_clause


def extract_defect_label(caption: str) -> Tuple[str, str]:
    """
    Returns a concise (1-2 word) defect label in English and Hindi for UI display.
    Examples: ('Garbage', 'कचरा'), ('Pothole', 'सड़क का गड्ढा'), ('Water Leak', 'जल रिसाव')
    """
    text_lower = caption.lower()
    for entry in CIVIC_TAXONOMY:
        if any(matches_keyword(text_lower, kw) for kw in entry["keywords"]):
            cue = entry["grounding_cue"].lower()
            if "garbage" in cue:
                return "Garbage Dump", "कचरा"
            elif "pothole" in cue:
                return "Pothole", "सड़क का गड्ढा"
            elif "dhas" in cue or "collapse" in cue:
                return "Road Cave-In", "धंसी सड़क"
            elif "crack" in cue or "damaged road" in cue:
                return "Road Damage", "सड़क क्षति"
            elif "street light" in cue or "light" in cue:
                return "Street Light", "स्ट्रीट लाइट"
            elif "water" in cue or "leak" in cue:
                return "Water Leakage", "जल रिसाव"
            elif "manhole" in cue or "sewer" in cue or "drain" in cue:
                return "Open Drain", "खुला नाला"
            elif "tree" in cue or "wire" in cue:
                return "Hazardous Wire/Tree", "खतरनाक तार/पेड़"

    # Fallback to first non-stopword tokens
    clean_words = [
        w for w in re.sub(r"[^a-zA-Z\s]", "", caption).split()
        if w.lower() not in ("a", "an", "the", "in", "on", "of", "at", "with", "visible", "large", "small", "there", "is", "are")
    ]
    en_label = " ".join(clean_words[:2]).title() if clean_words else "Civic Defect"
    return en_label, "नागरिक समस्या"


def translate_to_clean_hindi(text_en: str, t5_pipeline: Any) -> str:
    """
    Translates or summarizes an English municipal defect description into a formal Hindi sentence.
    Combines FLAN-T5 prompt generation with the domain taxonomy knowledge base for clean Devanagari script.
    """
    text_lower = text_en.lower()

    # 1. Fast match against domain taxonomy for accurate vernacular Hindi
    for entry in CIVIC_TAXONOMY:
        if any(matches_keyword(text_lower, kw) for kw in entry["keywords"]):
            return entry["hi"]

    # 2. Invoke FLAN-T5 with requested translation prompt
    prompt = f"Translate this municipal issue to clean Hindi: {text_en}"
    try:
        results = t5_pipeline(prompt, max_new_tokens=48, do_sample=False)
        generated_text = results[0]["generated_text"].strip() if results else ""
        # Check if the generated text has meaningful Devanagari or translated content
        if generated_text and any('\u0900' <= ch <= '\u097F' for ch in generated_text):
            return generated_text
    except Exception as t5_err:
        logger.warning("FLAN-T5 Hindi translation prompt fallback: %s", t5_err)

    # 3. Safe municipal fallback
    return "नगर पालिका क्षेत्र में सड़क अथवा नागरिक अवसंरचना संबंधी दोष"


def refine_citizen_text(
    raw_text: str,
    was_edited: bool,
    t5_pipeline: Any,
) -> Tuple[str, str, str]:
    """
    Normalizes casual / Hinglish citizen complaints into technical municipal English titles
    and provides the corresponding formal Hindi description.

    Returns:
        (final_en_title, final_hi_description, grounding_cue)
    """
    text_clean = raw_text.strip()
    text_lower = text_clean.lower()

    # Step A: Direct taxonomy lookup (handles colloquialisms like 'sadak dhas gyi h yaha', 'kachra pada h')
    matched_entry = None
    for entry in CIVIC_TAXONOMY:
        if any(matches_keyword(text_lower, k) for k in entry["keywords"]):
            matched_entry = entry
            break

    if was_edited:
        if matched_entry:
            final_en = matched_entry["en"]
            final_hi = matched_entry["hi"]
            grounding_cue = matched_entry["grounding_cue"]
        else:
            # Citizen provided a unique description -> prompt FLAN-T5 to convert to formal technical title
            flan_prompt = (
                f"Rewrite this citizen civic issue report into a concise, professional technical English "
                f"municipal hazard title:\nIssue: {text_clean}\nTitle:"
            )
            try:
                out = t5_pipeline(flan_prompt, max_new_tokens=32, do_sample=False)
                t5_title = out[0]["generated_text"].strip() if out else ""
            except Exception as t5_err:
                logger.warning("FLAN-T5 title rewriting error: %s", t5_err)
                t5_title = ""

            final_en = t5_title if (t5_title and len(t5_title) > 3) else text_clean.capitalize()
            final_hi = translate_to_clean_hindi(final_en, t5_pipeline)
            grounding_cue = final_en.split()[-1] if final_en else "defect"

    else:
        # was_edited == False: Citizen accepted suggested text or confirmed issue
        if matched_entry:
            final_en = matched_entry["en"]
            final_hi = matched_entry["hi"]
            grounding_cue = matched_entry["grounding_cue"]
        else:
            final_en = text_clean
            final_hi = translate_to_clean_hindi(text_clean, t5_pipeline)
            grounding_cue = text_clean.split()[-1] if text_clean else "defect"

    return final_en, final_hi, grounding_cue


def run_florence_phrase_grounding(
    image: Image.Image,
    phrase: str,
    grounding_cue: str,
    vlm_model: Any,
    vlm_processor: Any,
) -> List[float]:
    """
    Executes Florence-2 `<CAPTION_TO_PHRASE_GROUNDING>` task prompt.
    Returns the primary/largest bounding box [x1, y1, x2, y2] clamped to image dimensions.
    """
    task_prompt = "<CAPTION_TO_PHRASE_GROUNDING>"

    def _execute_grounding(target_phrase: str) -> List[List[float]]:
        full_prompt = f"{task_prompt}{target_phrase}"
        inputs = vlm_processor(text=full_prompt, images=image, return_tensors="pt")
        input_ids = inputs["input_ids"].to(DEVICE)
        pixel_values = inputs["pixel_values"].to(DEVICE, dtype=TORCH_DTYPE)

        with torch.no_grad():
            generated_ids = vlm_model.generate(
                input_ids=input_ids,
                pixel_values=pixel_values,
                max_new_tokens=1024,
                do_sample=False,
                num_beams=3,
            )

        generated_text = vlm_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed_answer = vlm_processor.post_process_generation(
            generated_text,
            task=task_prompt,
            image_size=(image.width, image.height),
        )
        return parsed_answer.get(task_prompt, {}).get("bboxes", [])

    # 1. Attempt grounding with primary defect cue (e.g., 'pothole', 'collapsed road', 'garbage')
    bboxes = _execute_grounding(grounding_cue)

    # 2. Fallback to full phrase if cue returned no bounding boxes
    if not bboxes and grounding_cue != phrase:
        bboxes = _execute_grounding(phrase)

    # 3. Fallback to generic keyword if still nothing found
    if not bboxes:
        bboxes = _execute_grounding("defect")

    if not bboxes:
        logger.warning(
            "No bounding box localized for phrase '%s' or cue '%s'. Defaulting to [0.0, 0.0, 0.0, 0.0].",
            phrase,
            grounding_cue,
        )
        return [0.0, 0.0, 0.0, 0.0]

    total_img_area = float(image.width * image.height)

    def calculate_box_area(box: List[float]) -> float:
        w = max(0.0, float(box[2]) - float(box[0]))
        h = max(0.0, float(box[3]) - float(box[1]))
        return w * h

    # Filter out candidate boxes that cover nearly the entire image (> 65% area is whole road/sky background)
    focal_boxes = [
        b for b in bboxes
        if (calculate_box_area(b) / total_img_area) <= 0.65 and (calculate_box_area(b) / total_img_area) >= 0.005
    ]

    if focal_boxes:
        # Choose the most prominent focal defect box among the reasonable candidates
        selected_box = max(focal_boxes, key=calculate_box_area)
    elif bboxes:
        # If all boxes are very large (> 65%), pick the smallest one rather than the largest one!
        selected_box = min(bboxes, key=calculate_box_area)
        # If even the smallest box covers > 70%, tighten it around the center-lower focal defect region
        if calculate_box_area(selected_box) / total_img_area > 0.70:
            cx = (selected_box[0] + selected_box[2]) / 2.0
            cy = (selected_box[1] + selected_box[3]) / 2.0
            w = (selected_box[2] - selected_box[0]) * 0.50
            h = (selected_box[3] - selected_box[1]) * 0.45
            selected_box = [cx - w / 2.0, cy - h / 2.0, cx + w / 2.0, cy + h / 2.0]
    else:
        logger.warning(
            "No bounding box localized for phrase '%s' or cue '%s'. Defaulting to [0.0, 0.0, 0.0, 0.0].",
            phrase,
            grounding_cue,
        )
        return [0.0, 0.0, 0.0, 0.0]

    # Clamp coordinates to image boundaries
    x1 = max(0.0, min(float(selected_box[0]), float(image.width)))
    y1 = max(0.0, min(float(selected_box[1]), float(image.height)))
    x2 = max(0.0, min(float(selected_box[2]), float(image.width)))
    y2 = max(0.0, min(float(selected_box[3]), float(image.height)))

    return [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)]


def generate_text_embedding(text: str, embed_model: SentenceTransformer) -> List[float]:
    """
    Generates a 384-dimensional dense semantic embedding vector using sentence-transformers/all-MiniLM-L6-v2.
    Converts numpy array output into a standard Python list of floats.
    """
    embedding_array = embed_model.encode(
        text,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return [float(val) for val in embedding_array.tolist()]


async def parse_and_validate_image(image: UploadFile) -> Image.Image:
    """
    Helper function to asynchronously read, validate, and normalize EXIF orientation of an uploaded image.
    """
    try:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file provided.",
            )

        raw_pil = Image.open(io.BytesIO(image_bytes))
        # Normalize EXIF orientation (e.g. smartphone photos taken in portrait/landscape)
        normalized_pil = ImageOps.exif_transpose(raw_pil)
        rgb_image = normalized_pil.convert("RGB")

    except HTTPException:
        raise
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid or recognized image format.",
        )
    except Exception as err:
        logger.error("Error reading and decoding uploaded image: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read and decode image: {str(err)}",
        )

    if rgb_image.width <= 0 or rgb_image.height <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image dimensions must be greater than zero.",
        )

    return rgb_image


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/", tags=["Info"])
async def root():
    """Service metadata and routing information."""
    return {
        "service": "Civic Hazard Reporting AI Microservice",
        "status": "online",
        "version": "2.1.0",
        "device": device_name,
        "models": {
            "vlm": VLM_MODEL_ID,
            "seq2seq": T5_MODEL_ID,
            "embeddings": EMBED_MODEL_ID,
        },
        "docs_url": "/docs",
        "endpoints": {
            "health": "GET /health",
            "preview": "POST /preview (Stage 1: Quick inspection)",
            "submit": "POST /submit (Stage 2: Final processing & vector generation)",
        },
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint returning service status and active runtime compute device."""
    return HealthResponse(
        status="healthy",
        service="civic-ai-vlm",
        device=device_name,
    )


@app.post("/preview", response_model=PreviewResponse, tags=["Human-in-the-Loop Workflow"])
async def preview_civic_issue(
    image: UploadFile = File(..., description="Uploaded image of the civic defect (JPEG, PNG, WEBP)"),
):
    """
    Stage 1: Quick inspection for frontend confirmation.

    Workflow:
      1. Parse uploaded image using PIL and normalize EXIF orientation.
      2. Run `Florence-2-base` with task `<MORE_DETAILED_CAPTION>` to automatically detect and describe the civic defect.
      3. Use `FLAN-T5` to translate/summarize the English description into a formal Hindi sentence.
      4. Run `Florence-2` phrase grounding on the first clause/defect cue of the caption to get an initial bounding box.
      5. DO NOT generate vector embeddings in this step (keeps preview fast).
    """
    vlm_model = MODELS.get("vlm_model")
    vlm_processor = MODELS.get("vlm_processor")
    t5_pipeline = MODELS.get("t5_pipeline")

    if None in (vlm_model, vlm_processor, t5_pipeline):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI models are not yet initialized or are currently loading.",
        )

    # 1. Parse image
    pil_image = await parse_and_validate_image(image)
    img_width, img_height = pil_image.width, pil_image.height

    # 2. Run Florence-2 <MORE_DETAILED_CAPTION>
    try:
        logger.info("Running Florence-2 <MORE_DETAILED_CAPTION> for preview inspection...")
        caption = run_florence_detailed_caption(
            image=pil_image,
            vlm_model=vlm_model,
            vlm_processor=vlm_processor,
        )
        logger.info("Florence-2 inspection caption: %s", caption)
        if not caption:
            caption = "A damaged road surface with visible defect"
    except Exception as err:
        logger.error("Florence-2 captioning failure in /preview: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Visual defect inspection failed: {str(err)}",
        )

    # 3. Translate/summarize into formal Hindi using FLAN-T5 & domain taxonomy
    try:
        logger.info("Translating description to formal Hindi...")
        hindi_translation = translate_to_clean_hindi(caption, t5_pipeline)
    except Exception as err:
        logger.error("Hindi translation failure in /preview: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hindi translation failed: {str(err)}",
        )

    # 4. Phrase grounding on first clause / defect cue
    try:
        grounding_cue, first_clause = extract_defect_cue_and_clause(caption)
        logger.info("Running initial phrase grounding for cue: '%s'...", grounding_cue)
        initial_bbox = run_florence_phrase_grounding(
            image=pil_image,
            phrase=first_clause,
            grounding_cue=grounding_cue,
            vlm_model=vlm_model,
            vlm_processor=vlm_processor,
        )
    except Exception as err:
        logger.error("Florence-2 phrase grounding failure in /preview: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Initial phrase grounding failed: {str(err)}",
        )

    defect_en, defect_hi = extract_defect_label(caption)

    return PreviewResponse(
        success=True,
        defect_type=BilingualIssue(
            en=defect_en,
            hi=defect_hi,
        ),
        suggested_description=BilingualIssue(
            en=caption,
            hi=hindi_translation,
        ),
        bounding_box=initial_bbox,
        image_dimensions=ImageDimensions(width=img_width, height=img_height),
    )


@app.post("/submit", response_model=SubmitResponse, tags=["Human-in-the-Loop Workflow"])
async def submit_civic_issue(
    image: UploadFile = File(..., description="Uploaded image of the civic hazard (JPEG, PNG, WEBP)"),
    final_text: str = Form(..., description="Either AI's suggested text or citizen's edited text"),
    was_edited: bool = Form(default=False, description="Flag indicating if the text was modified by user"),
):
    """
    Stage 2: Final processing, text refinement, grounding, and vector generation.

    Workflow:
      1. Parse image with PIL and normalize EXIF orientation.
      2. Text Refinement:
         - If `was_edited == True`: Run `FLAN-T5` to normalize and convert the citizen's
           casual/Hinglish text into a concise, professional technical English municipal hazard title
           (e.g., "sadak dhas gyi h yaha" -> "Collapsed asphalt road causing road hazard").
           Also generate the corresponding Hindi string.
         - If `was_edited == False`: Keep the existing text and its Hindi counterpart.
      3. Visual Grounding:
         - Run `Florence-2-base` using `<CAPTION_TO_PHRASE_GROUNDING>` with the finalized English hazard phrase
           to detect the bounding box [x1, y1, x2, y2].
      4. Severity Calculation:
         - Calculate defect bounding box area against total image area:
           * CRITICAL: Area % >= 25%
           * HIGH:     Area % >= 10%
           * MEDIUM:   Area % >= 3%
           * LOW:      Area % < 3%
      5. Semantic Vector Embedding:
         - Use `sentence-transformers/all-MiniLM-L6-v2` to convert the finalized English description
           into a 384-dimensional dense float vector.
    """
    vlm_model = MODELS.get("vlm_model")
    vlm_processor = MODELS.get("vlm_processor")
    t5_pipeline = MODELS.get("t5_pipeline")
    embed_model = MODELS.get("embed_model")

    if None in (vlm_model, vlm_processor, t5_pipeline, embed_model):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI models are not yet initialized or are currently loading.",
        )

    # 1. Parse image
    pil_image = await parse_and_validate_image(image)
    img_width, img_height = pil_image.width, pil_image.height

    # 2. Text Refinement
    try:
        logger.info(
            "Refining text (was_edited=%s, raw_input='%s')...",
            was_edited,
            final_text,
        )
        final_en, final_hi, grounding_cue = refine_citizen_text(
            raw_text=final_text,
            was_edited=was_edited,
            t5_pipeline=t5_pipeline,
        )
        logger.info("Refined text result -> EN: '%s', HI: '%s', Cue: '%s'", final_en, final_hi, grounding_cue)
    except Exception as err:
        logger.error("Text refinement failure in /submit: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text refinement failed: {str(err)}",
        )

    # 3. Visual Grounding with Florence-2
    try:
        logger.info("Executing visual grounding for finalized phrase: '%s'...", final_en)
        final_bbox = run_florence_phrase_grounding(
            image=pil_image,
            phrase=final_en,
            grounding_cue=grounding_cue,
            vlm_model=vlm_model,
            vlm_processor=vlm_processor,
        )
        logger.info("Final bounding box: %s", final_bbox)
    except Exception as err:
        logger.error("Florence-2 phrase grounding failure in /submit: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Visual defect grounding failed: {str(err)}",
        )

    # 4. Severity Calculation
    x1, y1, x2, y2 = final_bbox
    box_width = max(0.0, x2 - x1)
    box_height = max(0.0, y2 - y1)
    defect_area = box_width * box_height
    total_img_area = float(img_width * img_height)

    area_coverage_pct = round((defect_area / total_img_area) * 100.0, 2)
    area_coverage_pct = max(0.0, min(100.0, area_coverage_pct))
    severity = compute_severity(area_coverage_pct, final_en)

    # 5. Semantic Vector Embedding (384-dimensional dense float vector)
    try:
        logger.info("Generating 384-dimensional dense semantic embedding vector...")
        vector_embedding = generate_text_embedding(
            text=final_en,
            embed_model=embed_model,
        )
    except Exception as err:
        logger.error("Vector embedding failure in /submit: %s", err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector embedding generation failed: {str(err)}",
        )

    return SubmitResponse(
        success=True,
        was_edited=was_edited,
        final_issue=BilingualIssue(
            en=final_en,
            hi=final_hi,
        ),
        bounding_box=final_bbox,
        severity=severity,
        area_coverage_pct=area_coverage_pct,
        vector_embedding=vector_embedding,
    )


# ---------------------------------------------------------------------------
# Direct Execution Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
