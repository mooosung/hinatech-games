# hinatech-games

ひなテックGames - ブラウザゲーム集（https://hinata-ya.tech/games/）

## デプロイ手順

### 接続情報（.envから読み取り）

- ホスト: www76.conoha.ne.jp
- ポート: 8022
- ユーザー: c8103618
- 秘密鍵: .envの`SSH_KEY_PATH`を参照

### デプロイ先パス（重要）

**本番配信パス**: `/home/c8103618/public_html/hinata-ya.tech/games/`

- `/games/games/absorb/` → おさかなサバイバル
- `/games/games/slime-jump/` → スライムジャンパー
- 他のゲームも同様に `/games/games/{ゲーム名}/`

**注意**: `/wp-content/themes/hina-tech/` 配下にも同じファイルがあるが、こちらは配信されない。必ず上記パスにデプロイすること。

### デプロイコマンド例

```bash
# .envの値を使用
SSH_KEY="C:/Users/mook/Dropbox/哲史/_develop/teraterm/macro/key/key-2025-12-21-06-12.pem"
REMOTE="c8103618@www76.conoha.ne.jp"
REMOTE_BASE="/home/c8103618/public_html/hinata-ya.tech/games"

# ファイルアップロード
scp -i "$SSH_KEY" -P 8022 games/absorb/game.js $REMOTE:$REMOTE_BASE/games/absorb/game.js

# SSH接続
ssh -i "$SSH_KEY" -p 8022 $REMOTE
```

### キャッシュクリア（必須）

ConoHa WINGはnginxのコンテンツキャッシュがあるため、デプロイ後に必ずクリアする。

```bash
# SSH接続後に実行
curl -s 'http://127.0.0.1:9080/clearcache?cwd=/home/c8103618/public_html/hinata-ya.tech'
```

このAPIはWordPressプラグイン `cache-clear-conoha` が使っているもので、nginx側のキャッシュを全てパージする。

### キャッシュバスティング

HTMLの`<script>`タグにクエリパラメータをつけてブラウザキャッシュも回避する。

```html
<script src="game.js?v=20260220"></script>
```

デプロイ時にバージョン値を更新すること。

### デプロイ確認

```bash
# 配信されているファイルの内容を確認
curl -s 'https://hinata-ya.tech/games/games/absorb/index.html' | grep 'game.js'

# キャッシュ状態を確認（MISSなら最新ファイルが返る）
curl -sI 'https://hinata-ya.tech/games/games/absorb/index.html' | grep 'X-Nginx-Cache'
```
