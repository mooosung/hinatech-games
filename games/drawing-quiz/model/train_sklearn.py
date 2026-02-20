"""
Quick Draw MLP モデル学習スクリプト (scikit-learn)

scikit-learn の MLPClassifier で学習し、
TensorFlow.js 互換の model.json + weights.bin を直接出力する。

使い方:
  cd games/drawing-quiz/model
  pip install scikit-learn numpy
  python train_sklearn.py
"""

import os
import json
import struct
import numpy as np
from pathlib import Path

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

SAMPLES_PER_CLASS = 3000
IMG_SIZE = 28
NUM_CLASSES = len(CATEGORIES)

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "tfjs"


def load_npy(category_en, max_samples):
    """Quick Draw .npy ファイルを読み込む"""
    filename = category_en.replace(" ", "_") + ".npy"
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(
            f"{filepath} が見つかりません。先に node train.mjs を実行してデータをダウンロードしてください。"
        )
    data = np.load(str(filepath))
    return data[:max_samples]


def build_tfjs_model_json(weights_specs):
    """TF.js layers-model 形式の model.json を構築"""
    # Dense(256, relu) → Dense(128, relu) → Dense(NUM_CLASSES, softmax)
    model_config = {
        "class_name": "Sequential",
        "config": {
            "name": "sequential",
            "layers": [
                {
                    "class_name": "Dense",
                    "config": {
                        "units": 256,
                        "activation": "relu",
                        "use_bias": True,
                        "kernel_initializer": {"class_name": "GlorotUniform", "config": {"seed": None}},
                        "bias_initializer": {"class_name": "Zeros", "config": {}},
                        "name": "dense_1",
                        "dtype": "float32",
                        "batch_input_shape": [None, IMG_SIZE * IMG_SIZE],
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
                        "name": "dense_2",
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
                        "name": "dense_3",
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
                "weights": weights_specs,
            }
        ],
        "format": "layers-model",
        "generatedBy": "train_sklearn.py",
        "convertedBy": None,
    }


def sklearn_to_tfjs_weights(mlp):
    """scikit-learn MLPClassifier の重みを TF.js 形式に変換"""
    weight_data = bytearray()
    weight_specs = []

    for i, (W, b) in enumerate(zip(mlp.coefs_, mlp.intercepts_)):
        layer_name = f"dense_{i+1}"

        # カーネル (転置不要 - sklearn は [in, out] 形式)
        kernel = W.astype(np.float32)
        weight_data.extend(kernel.tobytes())
        weight_specs.append({
            "name": f"{layer_name}/kernel",
            "shape": list(kernel.shape),
            "dtype": "float32",
        })

        # バイアス
        bias = b.astype(np.float32)
        weight_data.extend(bias.tobytes())
        weight_specs.append({
            "name": f"{layer_name}/bias",
            "shape": list(bias.shape),
            "dtype": "float32",
        })

    return bytes(weight_data), weight_specs


def main():
    from sklearn.neural_network import MLPClassifier
    from sklearn.model_selection import train_test_split

    print(f"\n=== Quick Draw MLP 学習 (scikit-learn) ===")
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
    y = np.array(all_labels)

    print(f"\n合計: {len(X)} samples")

    # 2. Train/Test分割
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.1, random_state=42, stratify=y
    )
    print(f"Train: {len(X_train)}, Val: {len(X_val)}")

    # 3. 学習
    print("\n2. MLP学習開始...")
    mlp = MLPClassifier(
        hidden_layer_sizes=(256, 128),
        activation="relu",
        solver="adam",
        batch_size=128,
        learning_rate_init=0.001,
        max_iter=30,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=5,
        verbose=True,
        random_state=42,
    )
    mlp.fit(X_train, y_train)

    # 4. 評価
    train_acc = mlp.score(X_train, y_train)
    val_acc = mlp.score(X_val, y_val)
    print(f"\nTrain accuracy: {train_acc:.4f}")
    print(f"Val accuracy:   {val_acc:.4f}")

    # 5. TF.js形式で保存
    print("\n3. TF.js形式で保存中...")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    weight_data, weight_specs = sklearn_to_tfjs_weights(mlp)
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

    print(f"\n=== 完了 ===\n")


if __name__ == "__main__":
    main()
