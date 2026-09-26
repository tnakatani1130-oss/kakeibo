-- ============================================================
-- 家計簿アプリ Supabase 本番固定用スキーマ（支出/収入分離カテゴリ対応）
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. カテゴリテーブル（type: 'expense' | 'income' を追加）
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL DEFAULT 'expense', -- 'expense' or 'income'
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

-- 403 Forbidden防止の完全権限開放
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, postgres, service_role;

-- ============================================================
-- 初期マスタデータ
-- ============================================================

-- 支出 大カテゴリ (17種類)
INSERT INTO categories (name, type, icon, color, sort_order) VALUES
  ('食費',         'expense', '🍽️', '#FF6B6B', 1),
  ('日用品',       'expense', '🧻', '#4ECDC4', 2),
  ('趣味娯楽',     'expense', '🎮', '#A78BFA', 3),
  ('交際費',       'expense', '🤝', '#F59E0B', 4),
  ('交通費',       'expense', '🚃', '#3B82F6', 5),
  ('自動車',       'expense', '🚗', '#60A5FA', 6),
  ('衣服美容',     'expense', '💄', '#EC4899', 7),
  ('健康医療',     'expense', '🏥', '#10B981', 8),
  ('教養教育',     'expense', '📚', '#6366F1', 9),
  ('特別な支出',   'expense', '🛋️', '#F97316', 10),
  ('現金カード',   'expense', '💳', '#8B5CF6', 11),
  ('水道光熱費',   'expense', '💡', '#EAB308', 12),
  ('通信費',       'expense', '📱', '#06B6D4', 13),
  ('住宅',         'expense', '🏠', '#84CC16', 14),
  ('税社会保障',   'expense', '🏛️', '#64748B', 15),
  ('保険',         'expense', '🛡️', '#14B8A6', 16),
  ('その他',       'expense', '📦', '#94A3B8', 17)
ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type;

-- 収入 大カテゴリ (8種類)
INSERT INTO categories (name, type, icon, color, sort_order) VALUES
  ('給与',         'income',  '💰', '#10B981', 101),
  ('一時所得',     'income',  '🎁', '#F59E0B', 102),
  ('事業・副業',   'income',  '💼', '#3B82F6', 103),
  ('年金',         'income',  '👴', '#8B5CF6', 104),
  ('配当所得',     'income',  '📈', '#EC4899', 105),
  ('不動産所得',   'income',  '🏢', '#6366F1', 106),
  ('不明な入金',   'income',  '❓', '#64748B', 107),
  ('その他入金',   'income',  '💵', '#14B8A6', 108)
ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type;

-- 支出 サブカテゴリ挿入
DO $$
DECLARE
  cid UUID;
BEGIN
  -- 食費
  SELECT id INTO cid FROM categories WHERE name = '食費';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '食費', 1), (cid, '外食', 2), (cid, '食料品', 3), (cid, '朝食', 4),
      (cid, '昼食', 5), (cid, '夕食', 6), (cid, 'カフェ', 7), (cid, '配食サービス', 8), (cid, 'その他', 9)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 日用品
  SELECT id INTO cid FROM categories WHERE name = '日用品';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '日用品', 1), (cid, 'ドラッグストア', 2), (cid, 'その他', 3)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 趣味娯楽
  SELECT id INTO cid FROM categories WHERE name = '趣味娯楽';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, 'アウトドア', 1), (cid, 'スポーツ', 2), (cid, '映画', 3), (cid, '音楽', 4),
      (cid, 'ゲーム', 5), (cid, '本（趣味）', 6), (cid, '旅行', 7), (cid, 'サブスク', 8), (cid, 'その他', 9)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 交際費
  SELECT id INTO cid FROM categories WHERE name = '交際費';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '交際費', 1), (cid, '飲み会', 2), (cid, 'プレゼント', 3), (cid, '冠婚葬祭', 4), (cid, 'その他', 5)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 交通費
  SELECT id INTO cid FROM categories WHERE name = '交通費';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '交通費', 1), (cid, '電車', 2), (cid, 'バス', 3), (cid, 'タクシー', 4),
      (cid, '飛行機', 5), (cid, 'レンタカー', 6), (cid, '駐車場', 7), (cid, '駐輪場', 8), (cid, 'その他', 9)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 自動車
  SELECT id INTO cid FROM categories WHERE name = '自動車';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '自動車ローン', 1), (cid, '道路料金', 2), (cid, 'ガソリン', 3), (cid, '駐車場', 4),
      (cid, '車両', 5), (cid, '車検整備', 6), (cid, '自動車保険', 7)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 衣服美容
  SELECT id INTO cid FROM categories WHERE name = '衣服美容';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '衣服', 1), (cid, 'クリーニング', 2), (cid, '美容院理髪', 3), (cid, '化粧品', 4), (cid, 'アクセサリー', 5), (cid, 'その他', 6)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 健康医療
  SELECT id INTO cid FROM categories WHERE name = '健康医療';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, 'フィットネス', 1), (cid, 'ボディケア', 2), (cid, '医療費', 3), (cid, '薬', 4), (cid, 'その他', 5)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 教養教育
  SELECT id INTO cid FROM categories WHERE name = '教養教育';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '本（自己研鑽）', 1), (cid, '新聞雑誌', 2), (cid, '習い事', 3), (cid, '学費', 4), (cid, '塾', 5), (cid, 'その他', 6)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 特別な支出
  SELECT id INTO cid FROM categories WHERE name = '特別な支出';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '家具', 1), (cid, '家電', 2), (cid, '住宅リフォーム', 3), (cid, 'その他', 4)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 現金カード
  SELECT id INTO cid FROM categories WHERE name = '現金カード';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, 'ATM引き出し', 1), (cid, 'カード引き落とし', 2), (cid, '電子マネー', 3), (cid, '使途不明金', 4), (cid, 'その他', 5)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 水道光熱費
  SELECT id INTO cid FROM categories WHERE name = '水道光熱費';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '光熱費', 1), (cid, '電気代', 2), (cid, 'ガス灯油代', 3), (cid, '水道代', 4), (cid, 'その他', 5)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 通信費
  SELECT id INTO cid FROM categories WHERE name = '通信費';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '携帯電話', 1), (cid, '固定電話', 2), (cid, 'インターネット', 3), (cid, '放送視聴料', 4), (cid, '情報サービス', 5), (cid, '宅配便運送', 6), (cid, 'その他', 7)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 住宅
  SELECT id INTO cid FROM categories WHERE name = '住宅';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '住宅', 1), (cid, '家賃', 2), (cid, 'ローン返済', 3), (cid, '管理費積立金', 4), (cid, '地震火災保険', 5), (cid, 'その他', 6)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 税社会保障
  SELECT id INTO cid FROM categories WHERE name = '税社会保障';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '所得税住民税', 1), (cid, '年金保険料', 2), (cid, '健康保険', 3), (cid, 'その他', 4)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- 保険
  SELECT id INTO cid FROM categories WHERE name = '保険';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '生命保険', 1), (cid, '医療保険', 2), (cid, 'その他', 3)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

  -- その他
  SELECT id INTO cid FROM categories WHERE name = 'その他';
  IF cid IS NOT NULL THEN
    INSERT INTO subcategories (category_id, name, sort_order) VALUES
      (cid, '仕送り', 1), (cid, '事業経費', 2), (cid, '事業原価', 3), (cid, '事業投資', 4), (cid, '寄付金', 5), (cid, '雑費', 6)
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;

END $$;

-- 支払い方法
INSERT INTO payment_methods (name, icon, sort_order) VALUES
  ('現金',      '💵', 1),
  ('カードA',   '💳', 2),
  ('カードB',   '💳', 3),
  ('PayPay',    '📱', 4),
  ('銀行口座',  '🏦', 5)
ON CONFLICT (name) DO NOTHING;
