'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import type {
  Category,
  Subcategory,
  PaymentMethod,
  Transaction,
  MonthlySummary,
} from '@/types'
import QuickInput from './components/QuickInput'
import Dashboard from './components/Dashboard'

// ─────────────────────────────────────────
// Icons
// ─────────────────────────────────────────
function InputIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

type ActiveTab = 'input' | 'dashboard'

// ─────────────────────────────────────────
// Fetch helpers (client-side)
// ─────────────────────────────────────────
async function fetchMasterData(supabase: ReturnType<typeof createClient>, userId: string) {
  const [catsRes, subsRes, pmsRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('subcategories').select('*').order('sort_order'),
    supabase.from('payment_methods').select('*').order('sort_order'),
  ])
  return {
    categories: (catsRes.data ?? []) as Category[],
    subcategories: (subsRes.data ?? []) as Subcategory[],
    paymentMethods: (pmsRes.data ?? []) as PaymentMethod[],
  }
}


async function fetchTransactions(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from('transactions')
    .select(`
      *,
      category:categories(*),
      subcategory:subcategories(*),
      payment_method:payment_methods(*)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []) as Transaction[]
}

function buildSummary(transactions: Transaction[], categories: Category[]): MonthlySummary {
  // 今月のデータのみ
  const now = new Date()
  const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyTx = transactions.filter((tx) => tx.date.startsWith(yyyyMM))

  const totalExpense = monthlyTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const totalIncome = monthlyTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

  // カテゴリ別集計
  const catMap = new Map<string, number>()
  monthlyTx
    .filter((t) => t.type === 'expense' && t.category_id)
    .forEach((t) => {
      catMap.set(t.category_id!, (catMap.get(t.category_id!) ?? 0) + t.amount)
    })

  const byCategory = Array.from(catMap.entries())
    .map(([catId, total]) => ({
      category: categories.find((c) => c.id === catId)!,
      total,
      percentage: totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0,
    }))
    .filter((x) => x.category)
    .sort((a, b) => b.total - a.total)

  return { totalExpense, totalIncome, byCategory }
}

// ─────────────────────────────────────────
// Setup Default Data (初回ログイン時)
// ─────────────────────────────────────────
async function ensureDefaultData(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  try {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })

    if ((count ?? 0) > 0) return

    console.log('Inserting default data...')

    // 大カテゴリ
    const defaultCategories = [
      { name: '食費', icon: '🍽️', color: '#FF6B6B', sort_order: 1 },
      { name: '住居費', icon: '🏠', color: '#4ECDC4', sort_order: 2 },
      { name: '趣味', icon: '🎮', color: '#A78BFA', sort_order: 3 },
      { name: '交際費', icon: '🤝', color: '#F59E0B', sort_order: 4 },
      { name: '固定費', icon: '🔄', color: '#6366F1', sort_order: 5 },
      { name: '自己投資', icon: '📚', color: '#10B981', sort_order: 6 },
      { name: '収入', icon: '💰', color: '#F472B6', sort_order: 7 },
    ]

    const { data: insertedCats } = await supabase
      .from('categories')
      .upsert(defaultCategories, { onConflict: 'name' })
      .select()

    const catMap = new Map((insertedCats ?? []).map((c: any) => [c.name, c.id]))

    // サブカテゴリ
    const subcats: any[] = []
    if (catMap.has('食費')) {
      const id = catMap.get('食費')
      subcats.push(
        { category_id: id, name: '外食', sort_order: 1 },
        { category_id: id, name: '自炊', sort_order: 2 },
        { category_id: id, name: 'カフェ', sort_order: 3 },
        { category_id: id, name: 'コンビニ', sort_order: 4 }
      )
    }
    if (catMap.has('趣味')) {
      const id = catMap.get('趣味')
      subcats.push(
        { category_id: id, name: '推し活', sort_order: 1 },
        { category_id: id, name: 'ゲーム', sort_order: 2 },
        { category_id: id, name: '映画', sort_order: 3 },
        { category_id: id, name: '音楽', sort_order: 4 }
      )
    }
    if (subcats.length > 0) {
      await supabase.from('subcategories').upsert(subcats, { onConflict: 'category_id,name' })
    }

    // 支払い方法
    const defaultPms = [
      { name: '現金', icon: '💵', sort_order: 1 },
      { name: 'カードA', icon: '💳', sort_order: 2 },
      { name: 'カードB', icon: '💳', sort_order: 3 },
      { name: 'PayPay', icon: '📱', sort_order: 4 },
      { name: '銀行口座', icon: '🏦', sort_order: 5 },
    ]
    await supabase.from('payment_methods').upsert(defaultPms, { onConflict: 'name' })
  } catch (err) {
    console.error('ensureDefaultData error:', err)
  }
}



// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────
export default function Home() {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<ActiveTab>('input')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<MonthlySummary>({
    totalExpense: 0,
    totalIncome: 0,
    byCategory: [],
  })

  // ─── 認証 & データ初期化 ───
  const initialize = useCallback(async () => {
    setLoading(true)
    try {
      // Supabase anonymous / session check
      let { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // 匿名ログイン（Supabaseで有効にする必要あり）
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data.user) {
          setAuthError(true)
          setLoading(false)
          return
        }
        user = data.user
      }

      setUserId(user.id)
      await ensureDefaultData(supabase, user.id)

      const master = await fetchMasterData(supabase, user.id)
      setCategories(master.categories)
      setSubcategories(master.subcategories)
      setPaymentMethods(master.paymentMethods)

      const txs = await fetchTransactions(supabase, user.id)
      setTransactions(txs)
      setSummary(buildSummary(txs, master.categories))
    } catch (err) {
      console.error('Init error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    initialize()
  }, [initialize])

  const refreshData = useCallback(async () => {
    if (!userId) return
    const txs = await fetchTransactions(supabase, userId)
    setTransactions(txs)
    setSummary(buildSummary(txs, categories))
  }, [userId, supabase, categories])

  // ─── Loading Screen ───
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: 40 }}>💰</div>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>読み込み中...</div>
      </div>
    )
  }

  // ─── Auth Error Screen ───
  if (authError) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          flexDirection: 'column',
          gap: '16px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48 }}>⚙️</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800 }}>
          Supabase 設定が必要です
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
          Supabase の接続情報をご確認ください。
        </p>
        <button
          onClick={() => initialize()}
          style={{
            marginTop: 8,
            padding: '12px 28px',
            background: 'var(--gradient-primary)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          再試行
        </button>
      </div>
    )
  }



  // ─── Main App ───
  return (
    <div className="app-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          {activeTab === 'input' ? (
            <>
              <span className="gradient-text">記録する</span>
            </>
          ) : (
            <>
              <span className="gradient-text">ダッシュボード</span>
            </>
          )}
        </h1>
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'input' && userId ? (
        <QuickInput
          categories={categories}
          subcategories={subcategories}
          paymentMethods={paymentMethods}
          userId={userId}
          onSaved={refreshData}
          onRefreshMaster={async () => {
            const master = await fetchMasterData(supabase, userId)
            setCategories(master.categories)
            setSubcategories(master.subcategories)
            setPaymentMethods(master.paymentMethods)
          }}
        />
      ) : (

        <Dashboard
          transactions={transactions}
          categories={categories}
          summary={summary}
          onDeleted={refreshData}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="nav-bar">
        <button
          id="nav-input"
          className={`nav-btn ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          <InputIcon active={activeTab === 'input'} />
          記録
        </button>
        <button
          id="nav-dashboard"
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <DashboardIcon active={activeTab === 'dashboard'} />
          履歴
        </button>
      </nav>
    </div>
  )
}
