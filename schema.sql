-- ============================================================
-- 家計簿アプリ Supabase スキーマ定義 (確定・クリーンリセット版)
-- ============================================================

-- 既存のテーブルを一度すべて消去
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. カテゴリテーブル
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. サブカテゴリテーブル
CREATE TABLE subcategories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 支払い方法テーブル
CREATE TABLE payment_methods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 収支テーブル
CREATE TABLE transactions (
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

-- アクセス制限（RLS）を完全に解除し、自由な読み書きを許可
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
