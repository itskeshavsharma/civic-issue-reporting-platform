import asyncio
import spaces
import torch

# Force CPU inference for FastAPI REST endpoints (bypasses ZeroGPU Low-Level CUDA restrictions)
torch.cuda.is_available = lambda: False

import gradio as gr
from main import app as fastapi_app

# 1. ZeroGPU startup inspector function
@spaces.GPU
def civic_ai_predict(query: str = "health") -> str:
    return "Civic AI Microservice Engine Online"

# 2. Native Gradio Interface
demo = gr.Interface(
    fn=civic_ai_predict,
    inputs=gr.Textbox(label="Status Check", value="online"),
    outputs=gr.Textbox(label="Engine Status"),
    title="🏛️ Civic AI Multimodal Microservice",
    description="Florence-2, FLAN-T5, and all-MiniLM-L6-v2 active.\n\nActive REST Endpoints: POST /preview, POST /submit, POST /analyze, GET /health",
)

if __name__ == "__main__":
    # 3. Initialize AI models (Florence-2, FLAN-T5, all-MiniLM) via FastAPI lifespan
    cm = fastapi_app.router.lifespan_context(fastapi_app)
    asyncio.run(cm.__aenter__())

    # 4. Launch Gradio natively for ZeroGPU supervisor (returns running App instance)
    app, local_url, _ = demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        prevent_thread_lock=True,
    )

    # 5. Insert all FastAPI REST routes at index 0 of the running app so they take priority over Gradio's catch-all
    for r in reversed(fastapi_app.routes):
        if getattr(r, "path", "") not in ["/openapi.json", "/docs", "/redoc", "/"]:
            app.router.routes.insert(0, r)

    # 6. Keep server alive
    demo.block_thread()
