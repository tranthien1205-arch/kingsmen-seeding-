# -*- coding: utf-8 -*-
"""HUẤN LUYỆN LoRA MÔ HÌNH NGÔN NGỮ MỞ (ADR-009c-4) — chạy tại MÁY HỌC (GPU NVIDIA ≥ 8 GB, vd RTX 3070 Ti) hoặc GPU thuê.
Đầu vào: <tinh_nang>.train.jsonl do `node may-dung.mjs xuat-tap-mau` xuất (mỗi dòng {"messages":[system,user,assistant]}).
Đầu ra: thư mục out/ có adapter LoRA (out/lora) + file GGUF q4_k_m + Modelfile → `ollama create kingsmen-qwen:v1 -f Modelfile`
        → `node may-dung.mjs phien-ban kingsmen-qwen:v1 soan_nhap_agent` để đánh giá & gửi app duyệt.
Cài trên Windows (máy học): chạy tools/may-dung/cai-hoc-ngon-ngu.ps1 (Python 3.12 + torch CUDA + unsloth vào một venv riêng).
Cài trên Colab/RunPod:      pip install unsloth trl datasets
Chạy: python huan-luyen-ngon-ngu.py soan_nhap_agent.train.jsonl [--base unsloth/Qwen2.5-7B-Instruct-bnb-4bit] [--epochs 2]
      Thử nhanh không xuất GGUF: ... --max-steps 5 --khong-gguf
Card dưới 12 GB: tự hạ độ dài chuỗi 2048 và batch 1 (tích luỹ 8); card 8 GB còn tràn thì thêm --seq 1024. Tắt mô hình Ollama đang nạp trước khi chạy (ollama stop <tên>) để trả VRAM.
"""
import sys, json, argparse, os

ap = argparse.ArgumentParser()
ap.add_argument("train"); ap.add_argument("--base", default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit"); ap.add_argument("--epochs", type=int, default=2)
ap.add_argument("--out", default="out"); ap.add_argument("--r", type=int, default=16)
ap.add_argument("--seq", type=int, default=0, help="độ dài chuỗi tối đa; 0 = tự chọn theo VRAM (2048 nếu < 12 GB, 4096 nếu lớn hơn)")
ap.add_argument("--batch", type=int, default=0, help="batch mỗi bước; 0 = tự chọn (1 nếu < 12 GB, 2 nếu lớn hơn); tích luỹ giữ batch hiệu dụng 8")
ap.add_argument("--max-steps", type=int, default=-1, help="giới hạn số bước (thử nhanh); -1 = chạy đủ epochs")
ap.add_argument("--khong-gguf", action="store_true", help="chỉ lưu adapter LoRA, bỏ bước xuất GGUF")
a = ap.parse_args()
# unsloth ghi mã biên dịch vào ./unsloth_compiled_cache của thư mục đang đứng → đứng trong thư mục ra cho gọn
a.train = os.path.abspath(a.train); a.out = os.path.abspath(a.out)
os.makedirs(a.out, exist_ok=True); os.chdir(a.out)

# unsloth phải import TRƯỚC transformers/trl để vá đúng
from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig
from transformers import TrainerCallback

class TraVram(TrainerCallback):
    """Loss gộp của unsloth đo VRAM trống bằng torch.cuda.mem_get_info — phần PyTorch đang giữ (cache) bị tính là đã dùng.
    Card 8 GB: sau bước 1 cache giữ gần hết → 'No or negligible GPU memory available for fused cross entropy' (đo 24/09).
    Trả cache về trước mỗi lượt con để con số trống phản ánh đúng; chậm đi không đáng kể so với ~3 giây/lượt."""
    def on_step_begin(self, args, state, control, **kw): torch.cuda.empty_cache()
    def on_substep_end(self, args, state, control, **kw): torch.cuda.empty_cache()

if not torch.cuda.is_available():
    sys.exit("Không thấy GPU CUDA — máy này không huấn luyện được (cần NVIDIA + torch bản CUDA).")
tong_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
trong_gb = torch.cuda.mem_get_info()[0] / 1024**3
nho = tong_gb < 12
# Đo 24/09 trên RTX 3070 Ti 8 GB (có TraVram): seq 2048 → 5 bước 59 giây, VRAM đỉnh 7,1 GB; seq 1024 → 34 giây, 6,8 GB.
# Còn tràn (card đang gánh app khác) thì chạy lại với --seq 1024. Mẫu soạn nháp trung vị ~390 token.
seq = a.seq or (2048 if nho else 4096)
batch = a.batch or (1 if nho else 2)
grad = max(1, 8 // batch)
bf16 = torch.cuda.is_bf16_supported()
print(f"GPU {torch.cuda.get_device_name(0)} · {tong_gb:.1f} GB (trống {trong_gb:.1f} GB) · seq {seq} · batch {batch}×{grad} · {'bf16' if bf16 else 'fp16'}", flush=True)
if trong_gb < 6:
    print("⚠ VRAM trống dưới 6 GB — tắt bớt: `ollama ps` rồi `ollama stop <tên>`, đóng app nặng (Chrome, Zalo…). Vẫn thử chạy.", flush=True)

model, tok = FastLanguageModel.from_pretrained(a.base, max_seq_length=seq, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(model, r=a.r, lora_alpha=a.r * 2, lora_dropout=0, use_gradient_checkpointing="unsloth",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
ds = load_dataset("json", data_files=a.train, split="train")
def fmt(row):  # chat template của Qwen — giữ system + user + bài người đã duyệt
    return {"text": tok.apply_chat_template(row["messages"], tokenize=False)}
ds = ds.map(fmt, remove_columns=ds.column_names)
dai = [len(tok(x)["input_ids"]) for x in ds["text"]]
cat = sum(n > seq for n in dai)
print(f"{len(dai)} mẫu · trung vị {sorted(dai)[len(dai) // 2]} token · dài nhất {max(dai)}" + (f" · {cat} mẫu dài hơn {seq} bị cắt bớt (tăng --seq nếu card lớn)" if cat else ""), flush=True)
trainer = SFTTrainer(model=model, tokenizer=tok, train_dataset=ds, callbacks=[TraVram()],
    args=SFTConfig(output_dir=a.out, dataset_text_field="text", max_seq_length=seq, per_device_train_batch_size=batch, gradient_accumulation_steps=grad,
                   num_train_epochs=a.epochs, max_steps=a.max_steps, learning_rate=2e-4, logging_steps=1 if a.max_steps > 0 else 5,
                   save_strategy="no" if a.max_steps > 0 else "epoch", bf16=bf16, fp16=not bf16, warmup_ratio=0.05,
                   optim="adamw_8bit", report_to="none", dataset_num_proc=1))
kq = trainer.train()
print(f"Huấn luyện xong: {kq.global_step} bước · loss {kq.training_loss:.4f} · {kq.metrics.get('train_runtime', 0):.0f} giây · VRAM đỉnh {torch.cuda.max_memory_reserved() / 1024**3:.1f} GB", flush=True)
model.save_pretrained(os.path.join(a.out, "lora")); tok.save_pretrained(os.path.join(a.out, "lora"))
print("Đã lưu adapter LoRA:", os.path.join(a.out, "lora"), flush=True)
if a.khong_gguf:
    sys.exit(0)
# GGUF cho Ollama (q4_k_m ~ 4.7 GB với 7B). unsloth tự dựng llama.cpp lần đầu (cần git + cmake + trình biên dịch C++).
model.save_pretrained_gguf(os.path.join(a.out, "gguf"), tok, quantization_method="q4_k_m")
# unsloth 2026.9 ghi vào "<thư mục>_gguf" (out/gguf_gguf), bản cũ ghi vào out/gguf → tìm cả cây, ưu tiên q4_k_m
ds_gguf = sorted((os.path.join(g, f) for g, _, fs in os.walk(a.out) for f in fs if f.lower().endswith(".gguf")), key=lambda p: ("q4_k_m" not in p.lower(), p))
if not ds_gguf:
    sys.exit("Không thấy file .gguf trong " + a.out + " — xem log unsloth ở trên.")
gguf = os.path.relpath(ds_gguf[0], a.out).replace(os.sep, "/")
# Modelfile của unsloth (cạnh file gguf) mang TEMPLATE chat của Qwen — giữ lại, chỉ đổi FROM và thêm lời dặn Kingsmen
mf_unsloth = os.path.join(os.path.dirname(ds_gguf[0]), "Modelfile")
than = open(mf_unsloth, encoding="utf-8").read() if os.path.exists(mf_unsloth) else ""
than = "\n".join(d for d in than.splitlines() if not d.startswith("FROM ") and not d.startswith("SYSTEM ") and not d.startswith("PARAMETER temperature"))
with open(os.path.join(a.out, "Modelfile"), "w", encoding="utf-8") as f:
    f.write("FROM ./" + gguf + "\n" + than.strip() + "\nPARAMETER temperature 0.4\nSYSTEM \"Bạn là trợ lý nội dung của Kingsmen (keo ron gạch). Chỉ dùng dữ kiện thật, không bịa số, không cụm từ cấm.\"\n")
print("GGUF:", ds_gguf[0], f"({os.path.getsize(ds_gguf[0]) / 1024**3:.2f} GB)", flush=True)
# bản gộp 16-bit trung gian (~15 GB với 7B) không cần nữa khi đã có gguf
import shutil
for g in {os.path.join(a.out, "gguf")} - {os.path.dirname(ds_gguf[0])}:
    if os.path.isdir(g) and not any(f.lower().endswith(".gguf") for f in os.listdir(g)):
        shutil.rmtree(g, ignore_errors=True); print("Đã dọn bản gộp 16-bit trung gian:", g, flush=True)
print("XONG. Trên máy ghép chạy:  ollama create kingsmen-qwen:v1 -f", os.path.join(a.out, "Modelfile"))
print("Sau đó:  node may-dung.mjs phien-ban kingsmen-qwen:v1", os.path.basename(a.train).replace(".train.jsonl", ""))
