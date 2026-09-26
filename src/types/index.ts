// ============================================================
// 家計簿アプリ 型定義
// ============================================================

export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
}

export interface Subcategory {
  id: string
  user_id: string
  category_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface PaymentMethod {
  id: string
  user_id: string
  name: string
  icon: string | null
  sort_order: number
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  date: string
  type: TransactionType
  amount: number
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  memo: string | null
  created_at: string
  updated_at: string
  // Joined fields
  category?: Category
  subcategory?: Subcategory
  payment_method?: PaymentMethod
}

export interface NewTransaction {
  date: string
  type: TransactionType
  amount: number
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  memo: string
}

export interface MonthlySummary {
  totalExpense: number
  totalIncome: number
  byCategory: {
    category: Category
    total: number
    percentage: number
  }[]
}
