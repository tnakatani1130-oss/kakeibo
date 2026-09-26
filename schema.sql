-- ============================================================
-- 家計簿アプリ Supabase 本番固定用スキーマ（何度実行しても安全）
-- ※ テーブル削除（DROP）は含まれません。何度実行してもデータは保持されます。
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. カテゴリテーブル
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. サブカテゴリテーブル
CREATE TABLE IF NOT EXISTS subcategories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- 3. 支払い方法テーブル
CREATE TABLE IF NOT EXISTS payment_methods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 収支テーブル
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

-- アクセス制限（RLS）の完全解除
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 初期データ（ボタンデータ）の投入（既存データがある場合は重複追加しません）
INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('食費',     '🍽️',  '#FF6B6B', 1),
  ('住居費',   '🏠',  '#4ECDC4', 2),
  ('趣味',     '🎮',  '#A78BFA', 3),
  ('交際費',   '🤝',  '#F59E0B', 4),
  ('固定費',   '🔄',  '#6366F1', 5),
  ('自己投資', '📚',  '#10B981', 6),
  ('収入',     '💰',  '#F472B6', 7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name, icon, sort_order) VALUES
  ('現金',      '💵', 1),
  ('カードA',   '💳', 2),
  ('カードB',   '💳', 3),
  ('PayPay',    '📱', 4),
  ('銀行口座',  '🏦', 5)
ON CONFLICT (name) DO NOTHING;
