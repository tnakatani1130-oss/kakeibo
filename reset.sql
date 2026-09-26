-- ============================================================
-- 家計簿アプリ 既存テーブル消去（リセット専用使い捨てクエリ）
-- ⚠️ 実行すると既存のテーブルとデータがすべて削除されます
-- ============================================================

DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
