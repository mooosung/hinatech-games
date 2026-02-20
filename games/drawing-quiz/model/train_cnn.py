"""
Quick Draw CNN モデル学習スクリプト (PyTorch)

PyTorch の CNN で学習し、TF.js 互換の model.json + weights.bin を出力する。

使い方:
  cd games/drawing-quiz/model
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
  python train_cnn.py
"""

import os
import json
import numpy as np
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

# ============================================
# カテゴリ定義
# ============================================
CATEGORIES = [
    {"en": "cat", "ja": "ねこ"},
    {"en": "dog", "ja": "いぬ"},
    {"en": "rabbit", "ja": "うさぎ"},
    {"en": "elephant", "ja": "ぞう"},
    {"en": "fish", "ja": "さかな"},
    {"en": "bird", "ja": "とり"},
    {"en": "snake", "ja": "へび"},
    {"en": "lion", "ja": "ライオン"},
    {"en": "penguin", "ja": "ペンギン"},
    {"en": "bear", "ja": "くま"},
    {"en": "frog", "ja": "カエル"},
    {"en": "butterfly", "ja": "ちょうちょ"},
    {"en": "apple", "ja": "りんご"},
    {"en": "banana", "ja": "バナナ"},
    {"en": "cake", "ja": "ケーキ"},
    {"en": "pizza", "ja": "ピザ"},
    {"en": "ice cream", "ja": "アイス"},
    {"en": "car", "ja": "くるま"},
    {"en": "train", "ja": "でんしゃ"},
    {"en": "airplane", "ja": "ひこうき"},
    {"en": "bicycle", "ja": "じてんしゃ"},
    {"en": "house", "ja": "いえ"},
    {"en": "tree", "ja": "き（木）"},
    {"en": "flower", "ja": "はな"},
    {"en": "sun", "ja": "たいよう"},
    {"en": "star", "ja": "ほし"},
    {"en": "umbrella", "ja": "かさ"},
    {"en": "clock", "ja": "とけい"},
    {"en": "book", "ja": "ほん"},
    {"en": "key", "ja": "かぎ"},
    {"en": "snowman", "ja": "ゆきだるま"},
    {"en": "smiley face", "ja": "かお"},
    {"en": "mushroom", "ja": "キノコ"},
]

SAMPLES_PER_CLASS = 5000
IMG_SIZE = 28
NUM_CLASSES = len(CATEGORIES)
BATCH_SIZE = 256
EPOCHS = 20
LR = 0.001

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "tfjs"


# ============================================
# CNN モデル定義
# ============================================
class QuickDrawCNN(nn.Module):
    """
    Conv2D(32, 3x3, same) → ReLU → MaxPool(2)
    Conv2D(64, 3x3, same) → ReLU → MaxPool(2)
    Flatten → Dense(128) → ReLU → Dense(33)
    """
    def __init__(self, num_classes):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.dropout = nn.Dropout(0.4)
        self.fc2 = nn.Linear(128, num_classes)

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))   # [B, 32, 14, 14]
        x = self.pool(torch.relu(self.conv2(x)))   # [B, 64, 7, 7]
        x = x.view(x.size(0), -1)                  # [B, 3136]
        x = torch.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x


# ============================================
# データ読み込み
# ============================================
def load_npy(category_en, max_samples):
    filename = category_en.replace(" ", "_") + ".npy"
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(
            f"{filepath} が見つかりません。先にデータをダウンロードしてください。"
        )
    data = np.load(str(filepath))
    return data[:max_samples]


# ============================================
# データ拡張 (numpy)
# ============================================
def augment_batch(images):
    """ランダムなノイズ・シフトでデータ拡張"""
    augmented = images.copy()
    n = len(augmented)

    # ランダムノイズ (20%の確率)
    mask = np.random.random(n) < 0.2
    noise = np.random.normal(0, 0.05, augmented[mask].shape).astype(np.float32)
    augmented[mask] = np.clip(augmented[mask] + noise, 0, 1)

    # ランダムシフト (30%の確率, 1-2ピクセル)
    for i in range(n):
        if np.random.random() < 0.3:
            dx = np.random.randint(-2, 3)
            dy = np.random.randint(-2, 3)
            img = augmented[i].reshape(IMG_SIZE, IMG_SIZE)
            augmented[i] = np.roll(np.roll(img, dx, axis=1), dy, axis=0).flatten()

    return augmented


# ============================================
# PyTorch → TF.js 変換
# ============================================
def build_tfjs_model_json(weight_specs):
    """TF.js layers-model 形式の model.json (CNN版)"""
    model_config = {
        "class_name": "Sequential",
        "config": {
            "name": "sequential",
            "layers": [
                {
                    "class_name": "Conv2D",
                    "config": {
                        "filters": 32,
                        "kernel_size": [3, 3],
                        "strides": [1, 1],
                        "padding": "same",
                        "data_format": "channels_last",
                        "dilation_rate": [1, 1],
                        "activation": "relu",
                        "use_bias": True,
                        "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                        "bias_initializer": {"class_name": "Zeros", "config": {}},
                        "name": "conv2d_1",
                        "dtype": "float32",
                        "batch_input_shape": [None, IMG_SIZE, IMG_SIZE, 1],
                    },
                },
                {
                    "class_name": "MaxPooling2D",
                    "config": {
                        "pool_size": [2, 2],
                        "strides": [2, 2],
                        "padding": "valid",
                        "data_format": "channels_last",
                        "name": "max_pooling2d_1",
                    },
                },
                {
                    "class_name": "Conv2D",
                    "config": {
                        "filters": 64,
                        "kernel_size": [3, 3],
                        "strides": [1, 1],
                        "padding": "same",
                        "data_format": "channels_last",
                        "dilation_rate": [1, 1],
                        "activation": "relu",
                        "use_bias": True,
                        "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                        "bias_initializer": {"class_name": "Zeros", "config": {}},
                        "name": "conv2d_2",
                        "dtype": "float32",
                    },
                },
                {
                    "class_name": "MaxPooling2D",
                    "config": {
                        "pool_size": [2, 2],
                        "strides": [2, 2],
                        "padding": "valid",
                        "data_format": "channels_last",
                        "name": "max_pooling2d_2",
                    },
                },
                {
                    "class_name": "Flatten",
                    "config": {
                        "name": "flatten_1",
                    },
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "units": 128,
                        "activation": "relu",
                        "use_bias": True,
                        "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                        "bias_initializer": {"class_name": "Zeros", "config": {}},
                        "name": "dense_1",
                        "dtype": "float32",
                    },
                },
                {
                    "class_name": "Dense",
                    "config": {
                        "units": NUM_CLASSES,
                        "activation": "softmax",
                        "use_bias": True,
                        "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                        "bias_initializer": {"class_name": "Zeros", "config": {}},
                        "name": "dense_2",
                        "dtype": "float32",
                    },
                },
            ],
        },
    }

    return {
        "modelTopology": model_config,
        "weightsManifest": [
            {
                "paths": ["weights.bin"],
                "weights": weight_specs,
            }
        ],
        "format": "layers-model",
        "generatedBy": "train_cnn.py",
        "convertedBy": None,
    }


def pytorch_to_tfjs_weights(model):
    """PyTorch CNN の重みを TF.js 形式に変換"""
    weight_data = bytearray()
    weight_specs = []

    state = model.state_dict()

    # Conv2D 層: PyTorch [out, in, H, W] → TF.js [H, W, in, out]
    conv_layers = [
        ("conv1", "conv2d_1"),
        ("conv2", "conv2d_2"),
    ]
    for pt_name, tfjs_name in conv_layers:
        kernel = state[f"{pt_name}.weight"].numpy()
        kernel = kernel.transpose(2, 3, 1, 0)  # [out,in,H,W] → [H,W,in,out]
        kernel = kernel.astype(np.float32)
        weight_data.extend(kernel.tobytes())
        weight_specs.append({
            "name": f"{tfjs_name}/kernel",
            "shape": list(kernel.shape),
            "dtype": "float32",
        })

        bias = state[f"{pt_name}.bias"].numpy().astype(np.float32)
        weight_data.extend(bias.tobytes())
        weight_specs.append({
            "name": f"{tfjs_name}/bias",
            "shape": list(bias.shape),
            "dtype": "float32",
        })

    # Dense 層: PyTorch [out, in] → TF.js [in, out]
    dense_layers = [
        ("fc1", "dense_1"),
        ("fc2", "dense_2"),
    ]
    for pt_name, tfjs_name in dense_layers:
        kernel = state[f"{pt_name}.weight"].numpy()
        kernel = kernel.T.astype(np.float32)  # [out, in] → [in, out]
        weight_data.extend(kernel.tobytes())
        weight_specs.append({
            "name": f"{tfjs_name}/kernel",
            "shape": list(kernel.shape),
            "dtype": "float32",
        })

        bias = state[f"{pt_name}.bias"].numpy().astype(np.float32)
        weight_data.extend(bias.tobytes())
        weight_specs.append({
            "name": f"{tfjs_name}/bias",
            "shape": list(bias.shape),
            "dtype": "float32",
        })

    return bytes(weight_data), weight_specs


# ============================================
# メイン
# ============================================
def main():
    print(f"\n=== Quick Draw CNN 学習 (PyTorch) ===")
    print(f"カテゴリ数: {NUM_CLASSES}")
    print(f"サンプル/クラス: {SAMPLES_PER_CLASS}\n")

    # 1. データ読み込み
    print("1. データ読み込み中...")
    all_images = []
    all_labels = []

    for i, cat in enumerate(CATEGORIES):
        data = load_npy(cat["en"], SAMPLES_PER_CLASS)
        n = len(data)
        all_images.append(data)
        all_labels.extend([i] * n)
        print(f"  {cat['ja']} ({cat['en']}): {n} samples")

    X = np.vstack(all_images).astype(np.float32) / 255.0
    y = np.array(all_labels, dtype=np.int64)
    print(f"\n合計: {len(X)} samples")

    # 2. Train/Val 分割
    from sklearn.model_selection import train_test_split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.1, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train)}, Val: {len(X_val)}")

    # データ拡張
    print("データ拡張中...")
    X_train_aug = augment_batch(X_train)
    X_train = np.concatenate([X_train, X_train_aug])
    y_train = np.concatenate([y_train, y_train])
    print(f"拡張後 Train: {len(X_train)}")

    # 3. PyTorch Dataset
    X_train_t = torch.tensor(X_train.reshape(-1, 1, IMG_SIZE, IMG_SIZE))
    y_train_t = torch.tensor(y_train)
    X_val_t = torch.tensor(X_val.reshape(-1, 1, IMG_SIZE, IMG_SIZE))
    y_val_t = torch.tensor(y_val)

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds = TensorDataset(X_val_t, y_val_t)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE)

    # 4. モデル
    model = QuickDrawCNN(NUM_CLASSES)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)

    print(f"\n2. CNN学習開始... (epochs={EPOCHS})")
    total_params = sum(p.numel() for p in model.parameters())
    print(f"   パラメータ数: {total_params:,}")

    best_val_acc = 0
    best_state = None
    patience = 5
    no_improve = 0

    for epoch in range(EPOCHS):
        # Train
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0

        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            out = model(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * len(batch_x)
            train_correct += (out.argmax(1) == batch_y).sum().item()
            train_total += len(batch_x)

        # Validate
        model.eval()
        val_correct = 0
        val_total = 0
        val_loss = 0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                out = model(batch_x)
                loss = criterion(out, batch_y)
                val_loss += loss.item() * len(batch_x)
                val_correct += (out.argmax(1) == batch_y).sum().item()
                val_total += len(batch_x)

        train_acc = train_correct / train_total
        val_acc = val_correct / val_total
        scheduler.step(val_loss / val_total)
        lr = optimizer.param_groups[0]["lr"]

        print(f"  Epoch {epoch+1:2d}/{EPOCHS}: "
              f"train_acc={train_acc:.4f} val_acc={val_acc:.4f} "
              f"lr={lr:.6f}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1
            if no_improve >= patience:
                print(f"  → Early stopping (patience={patience})")
                break

    # ベストモデルを復元
    model.load_state_dict(best_state)
    model.eval()
    print(f"\nBest val accuracy: {best_val_acc:.4f}")

    # 5. TF.js形式で保存
    print("\n3. TF.js形式で保存中...")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    weight_data, weight_specs = pytorch_to_tfjs_weights(model)
    model_json = build_tfjs_model_json(weight_specs)

    with open(OUT_DIR / "model.json", "w") as f:
        json.dump(model_json, f)

    with open(OUT_DIR / "weights.bin", "wb") as f:
        f.write(weight_data)

    labels_out = [{"en": c["en"], "ja": c["ja"]} for c in CATEGORIES]
    with open(OUT_DIR / "labels.json", "w", encoding="utf-8") as f:
        json.dump(labels_out, f, ensure_ascii=False, indent=2)

    model_size = os.path.getsize(OUT_DIR / "model.json")
    weights_size = os.path.getsize(OUT_DIR / "weights.bin")
    print(f"  → model.json: {model_size/1024:.1f}KB")
    print(f"  → weights.bin: {weights_size/1024:.1f}KB")
    print(f"  → labels.json")

    print(f"\n=== 完了 (val_acc={best_val_acc:.4f}) ===\n")


if __name__ == "__main__":
    main()
