-- ============================================================
-- 家計簿アプリ Supabase スキーマ定義 (本番運用用・安全＆重複防止版)
-- ※ 既存データを壊さず、同名項目の重複登録をデータベースレベルで防ぎます
-- ============================================================

-- UUID拡張
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. カテゴリテーブル (大カテゴリ)
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL UNIQUE,           -- UNIQUEで同名カテゴリの重複を防止
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. サブカテゴリテーブル (中カテゴリ / タグ)
CREATE TABLE IF NOT EXISTS subcategories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)                   -- 同じカテゴリ内で同名のサブカテゴリ重複を防止
);

-- 3. 支払い方法テーブル
CREATE TABLE IF NOT EXISTS payment_methods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL UNIQUE,           -- UNIQUEで同名支払い方法の重複を防止
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 収支テーブル (メインデータ)
CREATE TABLE IF NOT EXISTS transactions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID,
  date               DATE NOT NULL DEFAULT CURRENT_DATE,
  type               TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id     UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  payment_method_id  UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  memo               TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- アクセス制限（RLS）の解除
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
