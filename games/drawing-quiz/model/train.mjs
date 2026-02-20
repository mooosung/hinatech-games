/**
 * Quick Draw CNN モデル学習スクリプト
 *
 * 使い方:
 *   cd games/drawing-quiz/model
 *   npm install @tensorflow/tfjs
 *   node --max-old-space-size=4096 train.mjs
 *
 * Google Quick Draw データセットから手書き画像を取得し、
 * 軽量CNNを学習してブラウザ用にエクスポートする。
 */

import * as tf from '@tensorflow/tfjs';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================
// カテゴリ定義 (Quick Draw英語名 → 日本語)
// ============================================
const CATEGORIES = [
  { en: 'cat', ja: 'ねこ' },
  { en: 'dog', ja: 'いぬ' },
  { en: 'rabbit', ja: 'うさぎ' },
  { en: 'elephant', ja: 'ぞう' },
  { en: 'fish', ja: 'さかな' },
  { en: 'bird', ja: 'とり' },
  { en: 'snake', ja: 'へび' },
  { en: 'lion', ja: 'ライオン' },
  { en: 'penguin', ja: 'ペンギン' },
  { en: 'bear', ja: 'くま' },
  { en: 'frog', ja: 'カエル' },
  { en: 'butterfly', ja: 'ちょうちょ' },
  { en: 'apple', ja: 'りんご' },
  { en: 'banana', ja: 'バナナ' },
  { en: 'cake', ja: 'ケーキ' },
  { en: 'pizza', ja: 'ピザ' },
  { en: 'ice cream', ja: 'アイス' },
  { en: 'car', ja: 'くるま' },
  { en: 'train', ja: 'でんしゃ' },
  { en: 'airplane', ja: 'ひこうき' },
  { en: 'bicycle', ja: 'じてんしゃ' },
  { en: 'house', ja: 'いえ' },
  { en: 'tree', ja: 'き（木）' },
  { en: 'flower', ja: 'はな' },
  { en: 'sun', ja: 'たいよう' },
  { en: 'star', ja: 'ほし' },
  { en: 'umbrella', ja: 'かさ' },
  { en: 'clock', ja: 'とけい' },
  { en: 'book', ja: 'ほん' },
  { en: 'key', ja: 'かぎ' },
  { en: 'snowman', ja: 'ゆきだるま' },
  { en: 'smiley face', ja: 'かお' },
  { en: 'mushroom', ja: 'キノコ' },
];

const SAMPLES_PER_CLASS = 200;
const VAL_RATIO = 0.1;
const BATCH_SIZE = 64;
const EPOCHS = 5;
const IMG_SIZE = 28;
const NUM_CLASSES = CATEGORIES.length;

// ============================================
// ダウンロードユーティリティ（リダイレクト対応）
// ============================================
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ============================================
// Quick Draw .npy ダウンロード
// ============================================
async function downloadNpy(category) {
  const url = `https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/${encodeURIComponent(category)}.npy`;
  const filePath = path.join(__dirname, 'data', `${category.replace(/ /g, '_')}.npy`);

  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    console.log(`  [cache] ${category}`);
    return filePath;
  }

  console.log(`  [download] ${category} ...`);
  const buf = await fetchUrl(url);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

// ============================================
// .npy パース
// ============================================
function parseNpy(filePath, maxSamples) {
  const buf = fs.readFileSync(filePath);
  const headerLen = buf.readUInt16LE(8);
  const headerStr = buf.toString('ascii', 10, 10 + headerLen);
  const shapeMatch = headerStr.match(/\((\d+),\s*(\d+)\)/);
  const rows = parseInt(shapeMatch[1]);
  const cols = parseInt(shapeMatch[2]);
  const dataOffset = 10 + headerLen;

  const n = Math.min(rows, maxSamples);
  const data = new Uint8Array(buf.buffer, buf.byteOffset + dataOffset, n * cols);
  return { data, rows: n, cols };
}

// ============================================
// モデル定義（軽量CNN）
// ============================================
function createModel() {
  const model = tf.sequential();

  model.add(tf.layers.conv2d({
    inputShape: [IMG_SIZE, IMG_SIZE, 1],
    filters: 16, kernelSize: 3, padding: 'same', activation: 'relu'
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(tf.layers.conv2d({
    filters: 32, kernelSize: 3, padding: 'same', activation: 'relu'
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  model.add(tf.layers.conv2d({
    filters: 64, kernelSize: 3, padding: 'same', activation: 'relu'
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  model.add(tf.layers.flatten());

  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: NUM_CLASSES, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

// ============================================
// TF.js ブラウザ形式で手動保存
// ============================================
async function saveModelManual(model, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  // IOHandler でモデルのアーティファクトを取得
  const saveResult = await model.save(tf.io.withSaveHandler(async (artifacts) => {
    // model.json 作成
    const modelJSON = {
      modelTopology: artifacts.modelTopology,
      weightsManifest: [{
        paths: ['weights.bin'],
        weights: artifacts.weightSpecs
      }],
      format: 'layers-model',
      generatedBy: 'TensorFlow.js train.mjs',
      convertedBy: null
    };
    fs.writeFileSync(
      path.join(outDir, 'model.json'),
      JSON.stringify(modelJSON)
    );

    // weights.bin 作成
    const weightBuf = Buffer.from(artifacts.weightData);
    fs.writeFileSync(path.join(outDir, 'weights.bin'), weightBuf);

    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
  }));

  return saveResult;
}

// ============================================
// メイン
// ============================================
async function main() {
  await tf.setBackend('cpu');
  await tf.ready();

  console.log(`\n=== Quick Draw CNN 学習 ===`);
  console.log(`カテゴリ数: ${NUM_CLASSES}`);
  console.log(`サンプル/クラス: ${SAMPLES_PER_CLASS}`);
  console.log(`バックエンド: ${tf.getBackend()}\n`);

  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

  // 1. データダウンロード
  console.log('1. データダウンロード中...');
  const npyFiles = [];
  for (const cat of CATEGORIES) {
    const fp = await downloadNpy(cat.en);
    npyFiles.push(fp);
  }

  // 2. データ読み込み
  console.log('\n2. データ読み込み中...');
  const allImages = [];
  const allLabels = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const { data, rows, cols } = parseNpy(npyFiles[i], SAMPLES_PER_CLASS);
    for (let r = 0; r < rows; r++) {
      const img = new Float32Array(IMG_SIZE * IMG_SIZE);
      for (let p = 0; p < cols; p++) {
        img[p] = data[r * cols + p] / 255.0;
      }
      allImages.push(img);
      allLabels.push(i);
    }
    console.log(`  ${CATEGORIES[i].ja} (${CATEGORIES[i].en}): ${rows} samples`);
  }

  // シャッフル
  const indices = Array.from({ length: allImages.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const totalSamples = allImages.length;
  const valCount = Math.floor(totalSamples * VAL_RATIO);
  const trainCount = totalSamples - valCount;

  console.log(`\n合計: ${totalSamples} samples (train: ${trainCount}, val: ${valCount})`);

  // テンソル作成
  console.log('\n3. テンソル作成中...');
  const xTrainBuf = new Float32Array(trainCount * IMG_SIZE * IMG_SIZE);
  const yTrainBuf = new Int32Array(trainCount);
  const xValBuf = new Float32Array(valCount * IMG_SIZE * IMG_SIZE);
  const yValBuf = new Int32Array(valCount);

  for (let i = 0; i < trainCount; i++) {
    const idx = indices[i];
    xTrainBuf.set(allImages[idx], i * IMG_SIZE * IMG_SIZE);
    yTrainBuf[i] = allLabels[idx];
  }
  for (let i = 0; i < valCount; i++) {
    const idx = indices[trainCount + i];
    xValBuf.set(allImages[idx], i * IMG_SIZE * IMG_SIZE);
    yValBuf[i] = allLabels[idx];
  }

  const xTrain = tf.tensor4d(xTrainBuf, [trainCount, IMG_SIZE, IMG_SIZE, 1]);
  const yTrain = tf.oneHot(tf.tensor1d(yTrainBuf, 'int32'), NUM_CLASSES);
  const xVal = tf.tensor4d(xValBuf, [valCount, IMG_SIZE, IMG_SIZE, 1]);
  const yVal = tf.oneHot(tf.tensor1d(yValBuf, 'int32'), NUM_CLASSES);

  // 4. 学習
  console.log('\n4. 学習開始...');
  const model = createModel();
  model.summary();

  const t0 = Date.now();
  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`  Epoch ${epoch + 1}/${EPOCHS} [${elapsed}s] - loss: ${logs.loss.toFixed(4)} acc: ${logs.acc.toFixed(4)} val_loss: ${logs.val_loss.toFixed(4)} val_acc: ${logs.val_acc.toFixed(4)}`);
      }
    }
  });

  // 5. エクスポート
  console.log('\n5. モデル保存中...');
  const outDir = path.join(__dirname, 'tfjs');
  await saveModelManual(model, outDir);
  console.log(`  → ${outDir}/model.json`);
  console.log(`  → ${outDir}/weights.bin`);

  // ラベルファイル
  const labelsOut = CATEGORIES.map(c => ({ en: c.en, ja: c.ja }));
  fs.writeFileSync(path.join(outDir, 'labels.json'), JSON.stringify(labelsOut, null, 2));
  console.log(`  → ${outDir}/labels.json`);

  // ファイルサイズ表示
  const modelSize = fs.statSync(path.join(outDir, 'model.json')).size;
  const weightsSize = fs.statSync(path.join(outDir, 'weights.bin')).size;
  console.log(`\nモデルサイズ: model.json=${(modelSize/1024).toFixed(1)}KB, weights.bin=${(weightsSize/1024).toFixed(1)}KB`);

  xTrain.dispose(); yTrain.dispose(); xVal.dispose(); yVal.dispose();
  console.log(`\n=== 完了 (${((Date.now() - t0) / 1000).toFixed(0)}秒) ===\n`);
}

main().catch(console.error);
