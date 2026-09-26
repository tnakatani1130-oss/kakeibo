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

function getCurrentYYYYMM(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function fetchMasterData(supabase: ReturnType<typeof createClient>) {
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
    .limit(300)

  return (data ?? []) as Transaction[]
}

function buildSummary(transactions: Transaction[], categories: Category[], yearMonth: string): MonthlySummary {
  const monthlyTx = transactions.filter((tx) => tx.date.startsWith(yearMonth))

  const totalExpense = monthlyTx
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  const totalIncome = monthlyTx
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

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

async function ensureDefaultData(
  supabase: ReturnType<typeof createClient>
) {
  try {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })

    if ((count ?? 0) > 0) return

    console.log('Inserting default user categories...')

    const defaultCategories = [
      { name: '食費', icon: '🍽️', color: '#FF6B6B', sort_order: 1 },
      { name: '日用品', icon: '🧻', color: '#4ECDC4', sort_order: 2 },
      { name: '趣味娯楽', icon: '🎮', color: '#A78BFA', sort_order: 3 },
      { name: '交際費', icon: '🤝', color: '#F59E0B', sort_order: 4 },
      { name: '交通費', icon: '🚃', color: '#3B82F6', sort_order: 5 },
      { name: '自動車', icon: '🚗', color: '#60A5FA', sort_order: 6 },
      { name: '衣服美容', icon: '💄', color: '#EC4899', sort_order: 7 },
      { name: '健康医療', icon: '🏥', color: '#10B981', sort_order: 8 },
      { name: '教養教育', icon: '📚', color: '#6366F1', sort_order: 9 },
      { name: '特別な支出', icon: '🛋️', color: '#F97316', sort_order: 10 },
      { name: '現金カード', icon: '💳', color: '#8B5CF6', sort_order: 11 },
      { name: '水道光熱費', icon: '💡', color: '#EAB308', sort_order: 12 },
      { name: '通信費', icon: '📱', color: '#06B6D4', sort_order: 13 },
      { name: '住宅', icon: '🏠', color: '#84CC16', sort_order: 14 },
      { name: '税社会保障', icon: '🏛️', color: '#64748B', sort_order: 15 },
      { name: '保険', icon: '🛡️', color: '#14B8A6', sort_order: 16 },
      { name: 'その他', icon: '📦', color: '#94A3B8', sort_order: 17 },
      { name: '給与', type: 'income', icon: '💰', color: '#10B981', sort_order: 101 },
      { name: '一時所得', type: 'income', icon: '🎁', color: '#F59E0B', sort_order: 102 },
      { name: '事業・副業', type: 'income', icon: '💼', color: '#3B82F6', sort_order: 103 },
      { name: '年金', type: 'income', icon: '👴', color: '#8B5CF6', sort_order: 104 },
      { name: '配当所得', type: 'income', icon: '📈', color: '#EC4899', sort_order: 105 },
      { name: '不動産所得', type: 'income', icon: '🏢', color: '#6366F1', sort_order: 106 },
      { name: '不明な入金', type: 'income', icon: '❓', color: '#64748B', sort_order: 107 },
      { name: 'その他入金', type: 'income', icon: '💵', color: '#14B8A6', sort_order: 108 },
    ]

    const { data: insertedCats } = await supabase
      .from('categories')
      .upsert(defaultCategories, { onConflict: 'name' })
      .select()

    const catMap = new Map((insertedCats ?? []).map((c: any) => [c.name, c.id]))

    const subCategoryMapping: Record<string, string[]> = {
      '食費': ['食費', '外食', '食料品', '朝食', '昼食', '夕食', 'カフェ', '配食サービス', 'その他'],
      '日用品': ['日用品', 'ドラッグストア', 'その他'],
      '趣味娯楽': ['アウトドア', 'スポーツ', '映画', '音楽', 'ゲーム', '本（趣味）', '旅行', 'サブスク', 'その他'],
      '交際費': ['交際費', '飲み会', 'プレゼント', '冠婚葬祭', 'その他'],
      '交通費': ['交通費', '電車', 'バス', 'タクシー', '飛行機', 'レンタカー', '駐車場', '駐輪場', 'その他'],
      '自動車': ['自動車ローン', '道路料金', 'ガソリン', '駐車場', '車両', '車検整備', '自動車保険'],
      '衣服美容': ['衣服', 'クリーニング', '美容院理髪', '化粧品', 'アクセサリー', 'その他'],
      '健康医療': ['フィットネス', 'ボディケア', '医療費', '薬', 'その他'],
      '教養教育': ['本（自己研鑽）', '新聞雑誌', '習い事', '学費', '塾', 'その他'],
      '特別な支出': ['家具', '家電', '住宅リフォーム', 'その他'],
      '現金カード': ['ATM引き出し', 'カード引き落とし', '電子マネー', '使途不明金', 'その他'],
      '水道光熱費': ['光熱費', '電気代', 'ガス灯油代', '水道代', 'その他'],
      '通信費': ['携帯電話', '固定電話', 'インターネット', '放送視聴料', '情報サービス', '宅配便運送', 'その他'],
      '住宅': ['住宅', '家賃', 'ローン返済', '管理費積立金', '地震火災保険', 'その他'],
      '税社会保障': ['所得税住民税', '年金保険料', '健康保険', 'その他'],
      '保険': ['生命保険', '医療保険', 'その他'],
      'その他': ['仕送り', '事業経費', '事業原価', '事業投資', '寄付金', '雑費'],
    }

    const subcats: any[] = []
    for (const [catName, subNames] of Object.entries(subCategoryMapping)) {
      const catId = catMap.get(catName)
      if (catId) {
        subNames.forEach((name, idx) => {
          subcats.push({ category_id: catId, name, sort_order: idx + 1 })
        })
      }
    }

    if (subcats.length > 0) {
      await supabase.from('subcategories').upsert(subcats, { onConflict: 'category_id,name' })
    }

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

export default function Home() {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<ActiveTab>('input')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  // 月選択 State (YYYY-MM)
  const [currentYM, setCurrentYM] = useState<string>(getCurrentYYYYMM())
  const [inputInitialDate, setInputInitialDate] = useState<string | undefined>(undefined)

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<MonthlySummary>({
    totalExpense: 0,
    totalIncome: 0,
    byCategory: [],
  })

  const initialize = useCallback(async () => {
    setLoading(true)
    try {
      let { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data.user) {
          setAuthError(true)
          setLoading(false)
          return
        }
        user = data.user
      }

      setUserId(user.id)
      await ensureDefaultData(supabase)

      const master = await fetchMasterData(supabase)
      setCategories(master.categories)
      setSubcategories(master.subcategories)
      setPaymentMethods(master.paymentMethods)

      const txs = await fetchTransactions(supabase, user.id)
      setTransactions(txs)
      setSummary(buildSummary(txs, master.categories, currentYM))
    } catch (err) {
      console.error('Init error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, currentYM])

  useEffect(() => {
    initialize()
  }, [initialize])

  const refreshData = useCallback(async () => {
    if (!userId) return
    const txs = await fetchTransactions(supabase, userId)
    setTransactions(txs)
    setSummary(buildSummary(txs, categories, currentYM))
  }, [userId, supabase, categories, currentYM])

  useEffect(() => {
    setSummary(buildSummary(transactions, categories, currentYM))
  }, [currentYM, transactions, categories])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 40 }}>💰</div>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>読み込み中...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⚙️</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800 }}>Supabase 設定が必要です</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>Supabase の接続情報をご確認ください。</p>
        <button onClick={() => initialize()} style={{ marginTop: 8, padding: '12px 28px', background: 'var(--gradient-primary)', border: 'none', borderRadius: 'var(--radius-full)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          再試行
        </button>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* ヘッダー */}
      <div className="page-header">
        <h1 className="page-title">
          {activeTab === 'input' ? <span className="gradient-text">記録する</span> : <span className="gradient-text">履歴・分析</span>}
        </h1>
      </div>

      {/* メインコンテンツ */}
      {activeTab === 'input' && userId ? (
        <QuickInput
          categories={categories}
          subcategories={subcategories}
          paymentMethods={paymentMethods}
          userId={userId}
          initialDate={inputInitialDate}
          onSaved={refreshData}
          onRefreshMaster={async () => {
            const master = await fetchMasterData(supabase)
            setCategories(master.categories)
            setSubcategories(master.subcategories)
            setPaymentMethods(master.paymentMethods)
          }}
        />
      ) : (
        <Dashboard
          transactions={transactions}
          categories={categories}
          subcategories={subcategories}
          paymentMethods={paymentMethods}
          summary={summary}
          currentYearMonth={currentYM}
          onChangeYearMonth={(ym) => setCurrentYM(ym)}
          onUpdated={refreshData}
          onRefreshMaster={async () => {
            const master = await fetchMasterData(supabase)
            setCategories(master.categories)
            setSubcategories(master.subcategories)
            setPaymentMethods(master.paymentMethods)
          }}
          onNavigateToInputWithDate={(dateStr) => {
            setInputInitialDate(dateStr)
            setActiveTab('input')
          }}
        />
      )}


      {/* ボトムナビゲーション */}
      <nav className="nav-bar">
        <button
          className={`nav-btn ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => {
            setInputInitialDate(undefined)
            setActiveTab('input')
          }}
        >
          <InputIcon active={activeTab === 'input'} />
          記録
        </button>
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <DashboardIcon active={activeTab === 'dashboard'} />
          履歴・分析
        </button>
      </nav>
    </div>
  )
}
