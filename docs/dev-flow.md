# 開発フロー

## 概要

GitHub Issue を起点に、Claude Code が自動で実装・PR作成まで行うフローです。
人間がやることは「Issueを書いて `claude` ラベルを付ける」だけです。

---

## フロー図

```
あなた
  │
  ├─ GitHub Issue を作成
  │     （タイトル＋実装内容を記述）
  │
  └─ `claude` ラベルを付ける
          │
          ▼
  GitHub Actions 起動
  （.github/workflows/claude-code.yml）
          │
          ▼
  Claude Code (anthropics/claude-code-action)
  ・コードを実装
  ・npm run lint で検証
  ・npm run build で検証
  ・新しいブランチ `claude/issue-{番号}-{日付}` にコミット＆プッシュ
          │
          ▼
  自動でPR作成
  ・`claude/issue-{番号}-{日付}` → `main`
  ・タイトル：Issueのタイトルそのまま
  ・本文：`Closes #{Issue番号}`
          │
          ▼
  あなたがPRをレビュー＆マージ
          │
          ▼
  mainに反映 ✅
```

---

## ブランチの命名規則

| 用途 | ブランチ名 |
|------|-----------|
| Claude が Issue を実装するブランチ | `claude/issue-{Issue番号}-{YYYYMMDD}-{HHMM}` |
| このワークフロー自体の修正ブランチ | `claude/add-claude-documentation-SJtII` （今回限り）|

---

## ファイル構成

```
.github/
  workflows/
    claude-code.yml   ← GitHub Actions の定義
```

### claude-code.yml の主なステップ

1. **`actions/checkout@v4`** — リポジトリをチェックアウト
2. **`anthropics/claude-code-action@beta`** — Claude Code を実行して実装
3. **Create Pull Request** — Claude が作ったブランチを検出してPRを自動作成

---

## 使い方（実際の手順）

1. GitHub の Issues ページで「New issue」
2. タイトルと実装内容（何をどう変えるか）を書く
3. ラベル `claude` を付けて作成
4. しばらく待つ（数分）
5. PRが自動で作成されるのでレビューしてマージ

---

## 注意点

- `claude` ラベルを付けたタイミングで Actions が起動します（付け直すと再実行）
- Actions の進捗は GitHub の Actions タブで確認できます
- PRはマージしない限り `main` には反映されません。必ずレビューしてからマージしてください
- ローカルに最新を取り込むには `git pull origin main`
