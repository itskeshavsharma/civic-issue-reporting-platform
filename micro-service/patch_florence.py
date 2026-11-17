import glob
import os
import re

cache_dir = os.path.expanduser("~/.cache/huggingface/modules/transformers_modules")

# 1. Patch configuration_florence2.py
config_files = glob.glob(os.path.join(cache_dir, "**/configuration_florence2.py"), recursive=True)
for cf in config_files:
    with open(cf, "r", encoding="utf-8") as f:
        content = f.read()

    modified = False
    if "if self.forced_bos_token_id is None" in content:
        content = content.replace(
            "if self.forced_bos_token_id is None",
            'if getattr(self, "forced_bos_token_id", None) is None'
        )
        modified = True

    if modified:
        with open(cf, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SUCCESS] Patched config file: {cf}")

# 2. Patch modeling_florence2.py
model_files = glob.glob(os.path.join(cache_dir, "**/modeling_florence2.py"), recursive=True)
for mf in model_files:
    with open(mf, "r", encoding="utf-8") as f:
        content = f.read()

    modified = False
    sdpa_pattern = re.compile(r"def _supports_sdpa\(self\):[\s\S]*?return self\.language_model\._supports_sdpa")
    if sdpa_pattern.search(content):
        content = sdpa_pattern.sub(
            'def _supports_sdpa(self):\n        return getattr(self, "language_model", None) is not None and getattr(self.language_model, "_supports_sdpa", False)',
            content
        )
        modified = True

    flash_pattern = re.compile(r"def _supports_flash_attn_2\(self\):[\s\S]*?return self\.language_model\._supports_flash_attn_2")
    if flash_pattern.search(content):
        content = flash_pattern.sub(
            'def _supports_flash_attn_2(self):\n        return getattr(self, "language_model", None) is not None and getattr(self.language_model, "_supports_flash_attn_2", False)',
            content
        )
        modified = True

    if modified:
        with open(mf, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SUCCESS] Patched model file: {mf}")

# 3. Patch processing_florence2.py
proc_files = glob.glob(os.path.join(cache_dir, "**/processing_florence2.py"), recursive=True)
for pf in proc_files:
    with open(pf, "r", encoding="utf-8") as f:
        content = f.read()

    modified = False
    if "tokenizer.additional_special_tokens +" in content:
        content = content.replace(
            "tokenizer.additional_special_tokens +",
            "getattr(tokenizer, 'additional_special_tokens', []) +"
        )
        modified = True

    # Remove duplicated resample if present
    if 'size={"height": 768, "width": 768},\n            resample=3,' in content:
        content = content.replace(
            'size={"height": 768, "width": 768},\n            resample=3,',
            'size={"height": 768, "width": 768},'
        )
        modified = True
    elif "pixel_values = self.image_processor(\n            images,\n            do_resize=do_resize," in content:
        content = content.replace(
            "pixel_values = self.image_processor(\n            images,\n            do_resize=do_resize,",
            'pixel_values = self.image_processor(\n            images,\n            size={"height": 768, "width": 768},\n            do_resize=True,'
        )
        modified = True

    if modified:
        with open(pf, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[SUCCESS] Patched processor file: {pf}")

print("[DONE] All Florence-2 compatibility patches complete.")
