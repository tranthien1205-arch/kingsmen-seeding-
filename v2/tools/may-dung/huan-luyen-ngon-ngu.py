# -*- coding: utf-8 -*-
"""HUẤN LUYỆN LoRA MÔ HÌNH NGÔN NGỮ MỞ (ADR-009c-4) — chạy trên GPU thuê (RunPod / Colab, ≥ 16 GB VRAM).
Đầu vào: <tinh_nang>.train.jsonl do `node may-dung.mjs xuat-tap-mau` xuất (mỗi dòng {"messages":[system,user,assistant]}).
Đầu ra: thư mục out/ có adapter LoRA + file GGUF q4_k_m + Modelfile → `ollama create kingsmen-qwen:v1 -f Modelfile` trên máy ghép
        → `node may-dung.mjs phien-ban kingsmen-qwen:v1 soan_nhap_agent` để đánh giá & gửi app duyệt.
Cài: pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git" trl datasets
Chạy: python huan-luyen-ngon-ngu.py soan_nhap_agent.train.jsonl [--base unsloth/Qwen2.5-7B-Instruct-bnb-4bit] [--epochs 2]
"""
import sys, json, argparse, os

ap = argparse.ArgumentParser()
ap.add_argument("train"); ap.add_argument("--base", default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit"); ap.add_argument("--epochs", type=int, default=2)
ap.add_argument("--out", default="out"); ap.add_argument("--r", type=int, default=16)
a = ap.parse_args()

from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig

model, tok = FastLanguageModel.from_pretrained(a.base, max_seq_length=4096, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(model, r=a.r, lora_alpha=a.r * 2, lora_dropout=0.05, target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
ds = load_dataset("json", data_files=a.train, split="train")
def fmt(row):  # chat template của Qwen — giữ system + user + bài người đã duyệt
    return {"text": tok.apply_chat_template(row["messages"], tokenize=False)}
ds = ds.map(fmt)
trainer = SFTTrainer(model=model, tokenizer=tok, train_dataset=ds, dataset_text_field="text",
    args=SFTConfig(output_dir=a.out, per_device_train_batch_size=2, gradient_accumulation_steps=4, num_train_epochs=a.epochs, learning_rate=2e-4, logging_steps=5, save_strategy="epoch", bf16=True, warmup_ratio=0.05))
trainer.train()
model.save_pretrained(os.path.join(a.out, "lora")); tok.save_pretrained(os.path.join(a.out, "lora"))
# GGUF cho Ollama (q4_k_m ~ 4.7 GB với 7B)
model.save_pretrained_gguf(os.path.join(a.out, "gguf"), tok, quantization_method="q4_k_m")
gguf = [f for f in os.listdir(os.path.join(a.out, "gguf")) if f.endswith(".gguf")][0]
with open(os.path.join(a.out, "Modelfile"), "w", encoding="utf-8") as f:
    f.write("FROM ./gguf/" + gguf + "\nPARAMETER temperature 0.4\nSYSTEM \"Bạn là trợ lý nội dung của Kingsmen (keo ron gạch). Chỉ dùng dữ kiện thật, không bịa số, không cụm từ cấm.\"\n")
print("XONG. Chép thư mục", a.out, "về máy ghép rồi chạy:  ollama create kingsmen-qwen:v1 -f", os.path.join(a.out, "Modelfile"))
print("Sau đó:  node may-dung.mjs phien-ban kingsmen-qwen:v1", os.path.basename(a.train).replace(".train.jsonl", ""))
