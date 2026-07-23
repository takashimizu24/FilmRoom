# FilmRoom を公開する（Railway 手順）

チーム全員が「いつでも・どこからでも・各自の端末で」使えるように、インターネット上に公開する手順です。
Railway というサービスに、このアプリ（Docker）を置きます。無料の https URL がもらえ、動画・DBはディスクに保存されます。

- 費用の目安: **月 約 $5**（Railway 従量課金）
- 必要なもの: **GitHub アカウント**（無料）と **Railway アカウント**（要クレジットカード登録）
- ドメイン購入は **不要**

---

## 事前情報（コピペ用）

デプロイ時に環境変数として使う値です。

```
NEXTAUTH_SECRET = （下記コマンドで生成した値。チャットでもお渡しします）
AUTH_TRUST_HOST = true            （Dockerに既定で入っているので設定不要）
DATABASE_FILE   = /app/data/prod.db  （Dockerに既定で入っているので設定不要）
NEXTAUTH_URL    = （手順5で決まる公開URL。例: https://filmroom-production.up.railway.app）
```

`NEXTAUTH_SECRET` はターミナルで次を実行して作れます:

```
openssl rand -base64 32
```

⚠️ この秘密の値は **このファイルやGitHubに書かない**でください（Railwayの Variables にだけ貼る）。一度決めたら変えないこと（変えると全員ログアウトされます）。

---

## ステップ1: コードを GitHub に置く

Railway は GitHub のコードを読み込みます。まだ GitHub に無いので、置きます。

**かんたんな方法（GitHub Desktop アプリ）**
1. https://desktop.github.com/ から GitHub Desktop をインストールし、GitHubアカウントでログイン。
2. 「File → Add Local Repository」で、このフォルダ `video-blog` を選ぶ。
3. 右下「Publish repository」を押す。**Private（非公開）**のままでOK。→ GitHub 上にリポジトリができます。

（ターミナルに慣れている場合: `gh repo create filmroom --private --source=. --push` でも可）

---

## ステップ2: Railway でプロジェクト作成

1. https://railway.app にアクセスし、**GitHubでサインアップ/ログイン**。
2. ダッシュボードで **「New Project」→「Deploy from GitHub repo」**。
3. さきほど公開した `filmroom`（または `video-blog`）リポジトリを選ぶ。
4. Railway が Dockerfile を自動で見つけてビルドを始めます（数分）。

---

## ステップ3: 保存用ディスク（Volume）を追加  ★重要

動画とデータベースを消えないように保存するため、ディスクを付けます。

1. プロジェクト内のサービス（FilmRoom）を開く。
2. 上部タブ **「Settings」→「Volumes」**（または右クリック →「Attach Volume」）。
3. **Mount path** に必ず次を入力: `/app/data`
4. サイズは初期値でOK（あとで増やせます）。保存。

> これで、DBは `/app/data/prod.db`、動画は `/app/data/uploads` に保存され、再起動しても消えません。

---

## ステップ4: 環境変数を設定

1. サービスの **「Variables」** タブを開く。
2. 次を追加:
   - `NEXTAUTH_SECRET` = （上の「事前情報」の値）
3. 保存（`AUTH_TRUST_HOST` と `DATABASE_FILE` は Docker に入っているので不要です）。

---

## ステップ5: 公開URLを発行して NEXTAUTH_URL を設定

1. **「Settings」→「Networking」→「Generate Domain」**（ポートは `3000`）。
2. 発行された URL（例 `https://filmroom-production.up.railway.app`）をコピー。
3. **「Variables」** に戻って追加:
   - `NEXTAUTH_URL` = `https://（発行されたドメイン）`
4. 保存すると自動で再デプロイされます。

---

## ステップ6: 動作確認

1. 発行された URL をスマホ/PCのブラウザで開く。
2. **Sign Up** で最初のアカウントを作成（あなた＝コーチ用）。
3. **Create Team** でチームを作成 → **Team** ページに表示される **招待コード** を控える。
4. 選手・保護者には URL と招待コードを共有 → 各自 Sign Up して **Join Team** で参加。

これで全員が使えます 🎉

---

## 更新のしかた（今後コードを直したとき）

GitHub Desktop で「Commit」→「Push」するだけで、Railway が自動で再デプロイします。データ（DB・動画）はディスクに残るので消えません。

---

## 注意点・制限

- **動画のサイズ**: アップロード動画はサーバーのメモリを使うため、長い試合フル動画などは **YouTube を使う**方が安定です。ローカルアップロードは短いクリップ向け。ディスク容量にも注意（Railwayで増設可）。
- **アップロード動画の公開範囲**: `/uploads/ファイル名` の URL を直接知っていれば（ログインしていなくても）再生できます。限定公開の練習動画などは、URLの共有範囲にご注意ください。※投稿一覧・コメントはログイン＋チーム所属が必須です。
- **最初のアカウント**: 誰でも Sign Up できますが、チームの投稿を見るには**招待コードでの参加が必須**です。知らない人が入るのを防ぐため、招待コードは信頼できる相手にのみ共有してください。
- **コスト**: 使わない時間が多ければ数ドル程度。ダッシュボードで使用量を確認できます。

---

## うまくいかない時

- ビルド失敗 → Railway の「Deployments」→ ログを確認。多くは環境変数の付け忘れ。
- ログインできない → `NEXTAUTH_URL` が実際の公開URL（https付き）になっているか確認。
- 動画/投稿が再起動で消える → Volume の Mount path が `/app/data` になっているか確認。

困ったらこの画面（ログのスクショ等）を共有してください。一緒に解決します。
