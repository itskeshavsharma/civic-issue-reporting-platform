# 🏛️ Civic Issue Reporting & Management System - AI Multimodal Microservice

A production-grade, standalone multimodal AI microservice built with **FastAPI**, **Microsoft Florence-2-base**, **Google FLAN-T5-base**, and **Sentence-Transformers (all-MiniLM-L6-v2)**.

This microservice acts as the computer vision, natural language normalization, and semantic deduplication engine for a municipal civic issue reporting platform (potholes, garbage piles, broken streetlights, water leakage, open manholes, fallen trees).

---

## 🏗️ System Architecture & Data Flow

```
┌─────────────────┐       Image + Optional Text        ┌─────────────────────────┐
│  React Frontend │ ─────────────────────────────────> │ Node.js/Express Backend │
└─────────────────┘                                    └───────────┬─────────────┘
                                                                   │
                                             Multipart Form-Data   │ HTTP POST /analyze
                                                                   ▼
                                                       ┌─────────────────────────┐
                                                       │   FastAPI AI Service    │
                                                       │       (Port 8000)       │
                                                       └───────────┬─────────────┘
                                                                   │
              ┌────────────────────────────────────────────────────┴────────────────────────────────────────────────────┐
              │                                                                                                         │
              ▼                                                                                                         ▼
┌──────────────────────────────────────────┐                                                          ┌──────────────────────────────────────────┐
│   CASE A: Zero-Shot (No Description)     │                                                          │   CASE B: Human-in-the-Loop              │
│ - Florence-2: <MORE_DETAILED_CAPTION>    │                                                          │ - Citizen enters English/Hindi/Hinglish  │
│ - FLAN-T5: Distills core defect title    │                                                          │   (e.g., "sadak tuti h bohot bada gaddha")│
│ - Formal clean Hindi summary generated   │                                                          │ - FLAN-T5: Normalizes into professional  │
│ - is_user_assisted = false               │                                                          │   technical English municipal title      │
└─────────────────────┬────────────────────┘                                                          │ - Formal clean Hindi summary generated   │
                      │                                                                               │ - is_user_assisted = true                │
                      │                                                                               └─────────────────────┬────────────────────┘
                      └───────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                            ┌────────────────────────────────────┐
                                            │      Bilingual Representation      │
                                            │ "en": Technical English label      │
                                            │ "hi": Formal clean Hindi summary   │
                                            └─────────────────┬──────────────────┘
                                                              │
                              ┌───────────────────────────────┴───────────────────────────────┐
                              │                                                               │
                              ▼                                                               ▼
             ┌─────────────────────────────────┐                             ┌─────────────────────────────────┐
             │    Florence-2 Visual Grounding  │                             │    Deduplication Embedding      │
             │ - <CAPTION_TO_PHRASE_GROUNDING> │                             │ - all-MiniLM-L6-v2              │
             │ - Primary Bbox: [x1, y1, x2, y2]│                             │ - 384-dimensional dense vector  │
             │ - Dynamic Severity (LOW-CRITICAL│                             │ - 50m spatial duplicate report  │
             │   based on defect pixel area %) │                             │   clustering in DB / MongoDB    │
             └─────────────────────────────────┘                             └─────────────────────────────────┘
```

---

## 🧠 Models Used & Hardware Optimization

| Model | Purpose | Architecture | Precision |
| :--- | :--- | :--- | :--- |
| **`microsoft/Florence-2-base`** | Visual Auto-Captioning & Defect Grounding | Vision-Language Foundation Model | `float16` (GPU) / `float32` (CPU) |
| **`google/flan-t5-base`** | Complaint Normalization & Text Processing | Instruction-Tuned Seq2Seq Transformer | `float16` (GPU) / `float32` (CPU) |
| **`sentence-transformers/all-MiniLM-L6-v2`** | 384-d Dense Semantic Vector Generation | Dense Sentence Embedding Transformer | `float32` |

- **Hardware Acceleration**: Automatically detects NVIDIA CUDA GPUs (e.g., RTX 4050/3060) and loads models in `torch.float16` for sub-second inference.
- **CPU Fallback**: Gracefully falls back to pure CPU execution (`torch.float32`) if no dedicated GPU is present.
- **In-Memory Lifespan Preloading**: All 3 models are initialized once into memory on server boot (`@asynccontextmanager lifespan`) to avoid per-request cold start latency.

---

## ⚡ Dynamic Severity Calculation

The service calculates the **Defect Area Coverage Percentage** against the full image resolution:

$$\text{Defect Area Coverage \%} = \frac{(x_2 - x_1) \times (y_2 - y_1)}{\text{Image Width} \times \text{Image Height}} \times 100$$

Severity is dynamically assigned based on coverage:

| Severity Level | Area Coverage % | Municipal Action Required |
| :--- | :--- | :--- |
| 🔴 **CRITICAL** | $\ge 25.0\%$ | Immediate dispatch / emergency road hazard barrier |
| 🟠 **HIGH** | $\ge 10.0\%$ | High priority scheduled maintenance (within 24 hours) |
| 🟡 **MEDIUM** | $\ge 3.0\%$ | Standard municipal queue (within 3-5 days) |
| 🟢 **LOW** | $< 3.0\%$ | Routine maintenance / minor surface defect |

---

## 🛠️ Installation & Setup

### 1. Create a Python Virtual Environment

```bash
cd "micro service"
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Windows (CMD):
.\venv\Scripts\activate.bat

# Linux / macOS:
source venv/bin/activate
```

### 2. Install PyTorch

Choose according to your hardware:

#### Option A: NVIDIA GPU Users (CUDA 12.4 - Recommended for fast speed)
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```

#### Option B: CPU Only Users (Bina GPU wale)
```bash
pip install torch torchvision
```

### 3. Install Microservice Dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Running the Microservice

### Option 1: One-Click Startup (Windows)
Double-click **`run.bat`** or run:
```powershell
.\run.bat
```

### Option 2: Manual Uvicorn Command
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The service will be live at: `http://localhost:8000`
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Technical Specification**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 API Endpoints & Response Schema

### 1. Health Check
- **Endpoint**: `GET /health`
- **Response**:
```json
{
  "status": "healthy",
  "service": "civic-ai-vlm",
  "device": "cuda (NVIDIA GeForce RTX 4050 Laptop GPU)"
}
```

---

### 2. Endpoint 1: Quick Inspection (`POST /preview`)
- **Stage**: Stage 1 (Fast visual inspection for frontend confirmation before final submission)
- **Content-Type**: `multipart/form-data`
- **Inputs**:
  - `image`: Image file (required, binary JPEG/PNG/WEBP)
- **Workflow**:
  1. Parses image and normalizes EXIF orientation.
  2. Runs `Florence-2-base` `<MORE_DETAILED_CAPTION>` to describe the scene and defect.
  3. Uses `FLAN-T5` to translate/summarize into a formal Hindi sentence.
  4. Runs `Florence-2` phrase grounding on defect cue to obtain initial bounding box `[x1, y1, x2, y2]`.
  5. Skips vector embedding generation for sub-second responsiveness.

#### Response JSON Format (`PreviewResponse`):
```json
{
  "success": true,
  "suggested_description": {
    "en": "A deep pothole on an asphalt road with standing water",
    "hi": "सड़क पर गहरा गड्ढा और जलभराव"
  },
  "bounding_box": [120.0, 340.0, 560.0, 780.0],
  "image_dimensions": {
    "width": 1024,
    "height": 768
  }
}
```

---

### 3. Endpoint 2: Final Submission & Verification (`POST /submit`)
- **Stage**: Stage 2 (Final processing, text refinement, visual grounding, severity rating, and vector generation)
- **Content-Type**: `multipart/form-data`
- **Inputs**:
  - `image`: Image file (required, binary JPEG/PNG/WEBP)
  - `final_text`: Text string (required, AI suggested text or citizen's edited text)
  - `was_edited`: Boolean flag (optional, default `false`)
- **Workflow**:
  1. Parses image with PIL and normalizes EXIF orientation.
  2. If `was_edited == true`: Runs `FLAN-T5` to normalize casual/Hinglish text (e.g., *"sadak dhas gyi h yaha"*) into a concise, professional technical English municipal title (*"Collapsed asphalt road causing road hazard"*) and clean Hindi string.
  3. If `was_edited == false`: Uses confirmed text and Hindi equivalent.
  4. Runs `Florence-2-base` phrase grounding (`<CAPTION_TO_PHRASE_GROUNDING>`) on finalized hazard phrase.
  5. Computes defect area coverage percentage and dynamic severity:
     - `CRITICAL`: Area % >= 25%
     - `HIGH`: Area % >= 10%
     - `MEDIUM`: Area % >= 3%
     - `LOW`: Area % < 3%
  6. Generates 384-dimensional dense semantic vector via `all-MiniLM-L6-v2` for 50m report deduplication.

#### Response JSON Format (`SubmitResponse`):
```json
{
  "success": true,
  "was_edited": true,
  "final_issue": {
    "en": "Collapsed asphalt road causing road hazard",
    "hi": "सड़क का धंसना और गड्ढा"
  },
  "bounding_box": [115.0, 330.0, 570.0, 790.0],
  "severity": "HIGH",
  "area_coverage_pct": 14.25,
  "vector_embedding": [
    0.042105,
    -0.128452,
    "... 384 float numbers ..."
  ]
}
```

---

## 🧪 Testing with cURL

### Step 1: Request Preview
```bash
curl -X POST "http://localhost:8000/preview" \
     -F "image=@/path/to/road_hazard.jpg"
```

### Step 2A: Confirm Preview (No Citizen Edits)
```bash
curl -X POST "http://localhost:8000/submit" \
     -F "image=@/path/to/road_hazard.jpg" \
     -F "final_text=A deep pothole on an asphalt road with standing water" \
     -F "was_edited=false"
```

### Step 2B: Submit Citizen Edit (Hinglish or Custom Text)
```bash
curl -X POST "http://localhost:8000/submit" \
     -F "image=@/path/to/road_hazard.jpg" \
     -F "final_text=sadak dhas gyi h yaha" \
     -F "was_edited=true"
```

---

## 🔗 Node.js / Express Backend Integration

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 1. Stage 1: Get Preview for User Confirmation
async function getReportPreview(imageFilePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imageFilePath));

  const response = await axios.post('http://localhost:8000/preview', form, {
    headers: { ...form.getHeaders() },
    timeout: 60000,
  });
  return response.data;
}

// 2. Stage 2: Final Submit
async function submitFinalReport(imageFilePath, finalText, wasEdited) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imageFilePath));
  form.append('final_text', finalText);
  form.append('was_edited', wasEdited ? 'true' : 'false');

  const response = await axios.post('http://localhost:8000/submit', form, {
    headers: { ...form.getHeaders() },
    timeout: 60000,
  });
  return response.data;
}
    // aiResult.detected_issue.en   -> "severely damaged asphalt road with deep pothole"
    // aiResult.detected_issue.hi   -> "सड़क पर गहरा गड्ढा एवं गंभीर रूप से क्षतिग्रस्त मार्ग"
    // aiResult.bounding_box        -> [x1, y1, x2, y2] (for frontend defect highlight canvas)
    // aiResult.severity            -> CRITICAL | HIGH | MEDIUM | LOW (for priority ticket queue)
    // aiResult.vector_embedding    -> [384 floats] (for spatial deduplication within 50m)

    res.json({ success: true, report: aiResult });
  } catch (error) {
    res.status(500).json({ error: 'AI Analysis Failed', details: error.message });
  }
});
```

---

## 🗺️ 50-Meter Spatial Duplicate Merging (MongoDB / PostGIS)

When a new report arrives with coordinates `(latitude, longitude)` and `vector_embedding`:

### Option 1: MongoDB Geospatial Query (2dsphere)
```javascript
// Step 1: Find all tickets submitted within 50 meters
const nearbyTickets = await Ticket.find({
  location: {
    $nearSphere: {
      $geometry: { type: "Point", coordinates: [longitude, latitude] },
      $maxDistance: 50 // 50 meters radius
    }
  },
  status: { $in: ["OPEN", "IN_PROGRESS"] }
});

// Step 2: Compare cosine similarity using the 384-d vector_embedding
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

let duplicateTicket = null;
for (const ticket of nearbyTickets) {
  const similarity = cosineSimilarity(aiResult.vector_embedding, ticket.vector_embedding);
  if (similarity >= 0.82) { // 82% semantic match
    duplicateTicket = ticket;
    break;
  }
}

if (duplicateTicket) {
  // Increment upvote count instead of creating a duplicate ticket
  duplicateTicket.upvotes += 1;
  await duplicateTicket.save();
} else {
  // Create a brand new ticket
  await Ticket.create({ ... });
}
```

---

## ⚙️ Environment Variables & Launching (`run.bat`)

Create `micro-service/.env`:
```env
HOST=0.0.0.0
PORT=8000
# FORCE_DEVICE=cuda    # Optional: forces NVIDIA GPU execution
# FORCE_DEVICE=cpu     # Optional: forces CPU fallback
CORS_ORIGINS=*
```

### Windows Launch (with automatic PyTorch App Control unblocking):
```cmd
cd micro-service
run.bat
```
`run.bat` automatically strips Windows App Control / Zone.Identifier flags from `torch_python.dll` and starts Uvicorn with CUDA GPU acceleration.
Interactive Swagger documentation: **`http://127.0.0.1:8000/docs`**

