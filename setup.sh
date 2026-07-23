#!/bin/bash
set -e

echo "=== Video Blog セットアップ ==="

# DB初期化 (初回のみ)
if [ ! -f prisma/dev.db ]; then
  echo "データベースを初期化中..."
  sqlite3 prisma/dev.db "
    CREATE TABLE \"User\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"name\" TEXT NOT NULL,
      \"email\" TEXT NOT NULL,
      \"password\" TEXT NOT NULL,
      \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX \"User_email_key\" ON \"User\"(\"email\");
    CREATE TABLE \"Team\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"name\" TEXT NOT NULL,
      \"inviteCode\" TEXT NOT NULL,
      \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX \"Team_inviteCode_key\" ON \"Team\"(\"inviteCode\");
    CREATE TABLE \"TeamMembership\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"userId\" TEXT NOT NULL,
      \"teamId\" TEXT NOT NULL,
      \"joinedAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT \"TeamMembership_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \"TeamMembership_teamId_fkey\" FOREIGN KEY (\"teamId\") REFERENCES \"Team\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX \"TeamMembership_userId_teamId_key\" ON \"TeamMembership\"(\"userId\", \"teamId\");
    CREATE TABLE \"Tag\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"name\" TEXT NOT NULL,
      \"teamId\" TEXT NOT NULL,
      CONSTRAINT \"Tag_teamId_fkey\" FOREIGN KEY (\"teamId\") REFERENCES \"Team\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX \"Tag_teamId_name_key\" ON \"Tag\"(\"teamId\", \"name\");
    CREATE TABLE \"Post\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"title\" TEXT NOT NULL,
      \"blocks\" TEXT NOT NULL,
      \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \"updatedAt\" DATETIME NOT NULL,
      \"authorId\" TEXT NOT NULL,
      \"teamId\" TEXT NOT NULL,
      CONSTRAINT \"Post_authorId_fkey\" FOREIGN KEY (\"authorId\") REFERENCES \"User\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \"Post_teamId_fkey\" FOREIGN KEY (\"teamId\") REFERENCES \"Team\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE
    );
    CREATE TABLE \"_PostToTag\" (
      \"A\" TEXT NOT NULL,
      \"B\" TEXT NOT NULL,
      CONSTRAINT \"_PostToTag_A_fkey\" FOREIGN KEY (\"A\") REFERENCES \"Post\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \"_PostToTag_B_fkey\" FOREIGN KEY (\"B\") REFERENCES \"Tag\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX \"_PostToTag_AB_unique\" ON \"_PostToTag\"(\"A\", \"B\");
    CREATE INDEX \"_PostToTag_B_index\" ON \"_PostToTag\"(\"B\");
    CREATE TABLE \"Message\" (
      \"id\" TEXT NOT NULL PRIMARY KEY,
      \"content\" TEXT NOT NULL,
      \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \"postId\" TEXT NOT NULL,
      \"userId\" TEXT NOT NULL,
      CONSTRAINT \"Message_postId_fkey\" FOREIGN KEY (\"postId\") REFERENCES \"Post\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \"Message_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  "
  echo "データベース初期化完了"
fi

echo ""
echo "=== .env.production を編集してください ==="
echo "  1. NEXTAUTH_URL → あなたのドメイン"
echo "  2. NEXTAUTH_SECRET → openssl rand -base64 32 で生成"
echo "  3. DOMAIN → あなたのドメイン"
echo ""
echo "編集後、以下を実行:"
echo "  cp .env.production .env"
echo "  docker compose up -d --build"
echo ""
echo "=== セットアップ完了 ==="
