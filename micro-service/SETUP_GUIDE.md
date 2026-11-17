# 🚀 Civic AI Multimodal Microservice - Complete Setup & Run Guide

Ye microservice **Civic Issue Reporting & Management System** (potholes, garbage piles, broken streetlights, water leakage, open manholes) ke liye intelligent AI multimodal engine hai.

---

## 🧠 Is Service Me Kaunse 3 AI Models Use Ho Rahe Hain?

1. **`microsoft/Florence-2-base` (Vision-Language Model)**:
   - **Zero-Shot Auto-Captioning** (`<MORE_DETAILED_CAPTION>`): Jab citizen koi description nahi deta, toh yeh model image dekhkar defect ko pehchanta hai.
   - **Visual Defect Grounding** (`<CAPTION_TO_PHRASE_GROUNDING>`): Image ke andar defect ka exact bounding box `[x1, y1, x2, y2]` locate karta hai aur defect area percentage calculate karta hai.
2. **`google/flan-t5-base` (Seq2Seq NLP Model)**:
   - **Dynamic Text Normalization**: Citizen ki casual / Hinglish bhasha (jaise *"sadak tuti h bohot bada gaddha h"*, *"kachra pada hai raste pe"*) ko formal technical English municipal title me convert karta hai.
   - **Hindi Translation**: Har civic complaint ka formal, shuddh Hindi summary generate karta hai.
3. **`sentence-transformers/all-MiniLM-L6-v2` (Semantic Embedding Model)**:
   - Normalized English description se ek **384-dimensional dense float vector** generate karta hai, taaki MongoDB / PostGIS me 50 meter ke radius ke andar aane wali duplicate reports ko merge kiya ja sake.

---

## 🔀 Dual-Mode Workflow (Kaise Kaam Karta Hai?)

| Mode | Input | Process | Response me `is_user_assisted` |
| :--- | :--- | :--- | :--- |
| **Case A (Zero-Shot)** | Sirf Image (Koi text nahi) | Florence-2 photo ko inspect karega -> FLAN-T5 title aur Hindi summary banayega. | `false` |
| **Case B (Human-in-the-Loop)** | Image + Casual Text (English, Hindi, ya Hinglish) | Florence-2 auto-captioning nahi karega. FLAN-T5 text ko formal English aur Hindi me normalize karega. | `true` |

---

## 📋 Prerequisites (Jaruri Cheezein)

1. **Python 3.10, 3.11, 3.12, ya 3.13** installed hona chahiye.
   - Terminal me check karein:
     ```bash
     python --version
     ```
2. **Git** ya project folder downloaded hona chahiye.

---

## 🛠️ Step-by-Step Installation

### Step 1: Project Directory Me Jaayein

Terminal (PowerShell / Command Prompt) kholein:

```bash
cd "micro service"
```

---

### Step 2: Virtual Environment Banayein aur Activate Karein

#### Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(Agar script permission error aaye toh chalayein: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

#### Windows (Command Prompt - CMD):
```cmd
python -m venv venv
venv\Scripts\activate.bat
```

#### Linux / macOS:
```bash
python3 -m venv venv
source venv/bin/activate
```

> **Verify:** Terminal prompt ke shuru me `(venv)` dikhna chahiye.

---

### Step 3: PyTorch Install Karein (Option A ya Option B Choose Karein)

---

#### 🟢 Option A: Jinke Paas NVIDIA GPU Hai (CUDA Acceleration - Fast Speed)
Agar aapke laptop/desktop me NVIDIA GeForce (GTX / RTX 3050, 4050, 4060, etc.) card hai:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
```
*(Yeh models ko GPU memory me `torch.float16` precision par lightning-fast speed se run karega).*

---

#### 🔵 Option B: Jinke Paas GPU NAHI Hai (CPU Only)
Agar aapke paas Intel / AMD integrated graphics hai ya dedicated GPU nahi hai:

```bash
pip install torch torchvision
```
*(Yeh chhota download hai aur CPU par `torch.float32` me chalega. Hamara code automatically GPU na milne par clean CPU mode me switch ho jata hai).*

---

### Step 4: Baki Requirements Install Karein

```bash
pip install -r requirements.txt
```

---

### Step 5: Server Run Karein

Virtual environment active rakhte hue yeh command chalayein:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Ya Windows par **`run.bat`** par double click karein!

---

## ⏳ Pehli Baar Start Hone Par Kya Hoga?

Pehli baar server launch hone par Hugging Face se 3 models cache honge:
1. `microsoft/Florence-2-base` (~900 MB)
2. `google/flan-t5-base` (~990 MB)
3. `sentence-transformers/all-MiniLM-L6-v2` (~90 MB)

Yeh download **sirf ek baar** hota hai. Uske baad local cache se models 10-15 seconds me direct load ho jaate hain.

Server ready hone par terminal me dikhega:
```
[INFO] All AI models loaded and ready.
INFO: Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## 🧪 Kaise Test Karein? (Testing the Endpoints)

### Tarika 1: Interactive Swagger UI (Browser Se)

1. Browser me visit karein:
   👉 **http://localhost:8000/docs**
2. **`GET /health`** par click karein -> **Try it out** -> **Execute**:
   - GPU users ko dikhega: `"device": "cuda (NVIDIA GeForce ...)"`
   - CPU users ko dikhega: `"device": "cpu"`
3. **`POST /analyze`** par click karein -> **Try it out**:
   - **Case A Test (Zero-Shot)**: Road pothole ya garbage ki image upload karein aur `user_description` ko **khali (blank)** chhod dein -> **Execute** karein. Model khud scene pehchankar title banayega (`is_user_assisted: false`).
   - **Case B Test (Human-in-the-Loop)**: Image upload karein aur `user_description` me Hinglish likhein (jaise `"sadak tuti h bohot bada gaddha h"`) -> **Execute** karein. Model text ko formal technical English aur formal Hindi me normalize karega (`is_user_assisted: true`).

---

### Tarika 2: cURL Command Se

#### Test 1: Zero-Shot (No Description)
```bash
curl -X POST "http://localhost:8000/analyze" \
     -F "image=@sample_defect.jpg"
```

#### Test 2: Human-in-the-Loop (Hinglish Input)
```bash
curl -X POST "http://localhost:8000/analyze" \
     -F "image=@sample_defect.jpg" \
     -F "user_description=sadak tuti h bohot bada gaddha h"
```

---

## 📦 Exact Response JSON Output

```json
{
  "success": true,
  "is_user_assisted": true,
  "detected_issue": {
    "en": "severely damaged asphalt road with deep pothole",
    "hi": "सड़क पर गहरा गड्ढा एवं गंभीर रूप से क्षतिग्रस्त मार्ग"
  },
  "bounding_box": [159.04, 118.32, 482.24, 362.64],
  "image_dimensions": {
    "width": 640,
    "height": 480
  },
  "area_coverage_pct": 25.7,
  "severity": "CRITICAL",
  "vector_embedding": [
    0.024512,
    -0.081294,
    0.013941,
    "... 384 float numbers ..."
  ]
}
```

---

## 🔗 Node.js / Express Backend Integration

Apne Express backend route me is microservice ko call karein:

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function analyzeCivicReport(imagePath, userDescription) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  if (userDescription && userDescription.trim()) {
    form.append('user_description', userDescription.trim());
  }

  const response = await axios.post('http://localhost:8000/analyze', form, {
    headers: { ...form.getHeaders() },
    timeout: 60000,
  });

  return response.data;
}

// Example usage in Express controller:
app.post('/api/reports', upload.single('image'), async (req, res) => {
  try {
    const aiData = await analyzeCivicReport(req.file.path, req.body.description);

    // aiData.is_user_assisted    -> true / false
    // aiData.detected_issue.en   -> "severely damaged asphalt road with deep pothole"
    // aiData.detected_issue.hi   -> "सड़क पर गहरा गड्ढा एवं गंभीर रूप से क्षतिग्रस्त मार्ग"
    // aiData.bounding_box        -> [x1, y1, x2, y2]
    // aiData.severity            -> CRITICAL | HIGH | MEDIUM | LOW
    // aiData.vector_embedding    -> [384 floats] (for duplicate check within 50m)

    res.json({ success: true, analysis: aiData });
  } catch (err) {
    res.status(500).json({ error: 'AI processing failed', message: err.message });
  }
});
```

---

## ❓ FAQ & Troubleshooting

### Q1: `AttributeError: 'Florence2LanguageConfig' object has no attribute 'forced_bos_token_id'`
**Solution:** Yeh issue resolve ho chuka hai. Hamare `main.py` me self-healing compatibility patch shamil hai aur `requirements.txt` me `transformers 4.48.3` pin kiya gaya hai jo 100% stable hai.

### Q2: CUDA out of memory error (GPU Users)
**Solution:** Background me heavy games ya AI apps chal rahi hon toh band karein. Florence-2 aur FLAN-T5 `torch.float16` me sirf ~2.5 GB VRAM use karte hain, jo 4GB/6GB cards par aaram se fit ho jaata hai.

### Q3: Kya CPU par speed theek aayegi?
**Solution:** Haan! FLAN-T5 aur all-MiniLM CPU par instant respond karte hain, aur Florence-2 CPU par 2-3 seconds me bounding box de deta hai.
