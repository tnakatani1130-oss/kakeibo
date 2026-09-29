'use client'

import { useState } from 'react'
import type { Transaction, Category, Subcategory, PaymentMethod, MonthlySummary } from '@/types'
import { createClient } from '@/lib/supabase'
import DonutChart from './DonutChart'
import EditTransactionModal from './EditTransactionModal'

function formatAmount(n: number): string {
  return n.toLocaleString('ja-JP')
}

interface DashboardProps {
  transactions: Transaction[]
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  summary: MonthlySummary
  currentYearMonth: string // "YYYY-MM"
  onChangeYearMonth: (ym: string) => void
  onUpdated: () => void
  onRefreshMaster: () => void
  onNavigateToInputWithDate: (dateStr: string) => void
}

export default function Dashboard({
  transactions,
  categories,
  subcategories,
  paymentMethods,
  summary,
  currentYearMonth,
  onChangeYearMonth,
  onUpdated,
  onRefreshMaster,
  onNavigateToInputWithDate,
}: DashboardProps) {
  const supabase = createClient()
  const [subTab, setSubTab] = useState<'chart' | 'calendar' | 'list'>('chart')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // 編集用・削除用の Transaction
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null)
  
  // カレンダータップで選択された日付のモーダル
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null)

  // 年月を操作
  const handlePrevMonth = () => {
    const [y, m] = currentYearMonth.split('-').map(Number)
    const prevDate = new Date(y, m - 2, 1)
    const ym = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    onChangeYearMonth(ym)
  }

  const handleNextMonth = () => {
    const [y, m] = currentYearMonth.split('-').map(Number)
    const nextDate = new Date(y, m, 1)
    const ym = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    onChangeYearMonth(ym)
  }

  // 削除の最終実行
  const confirmDelete = async () => {
    if (!pendingDeleteTx) return
    setDeletingId(pendingDeleteTx.id)
    try {
      await supabase.from('transactions').delete().eq('id', pendingDeleteTx.id)
      setPendingDeleteTx(null)
      onUpdated()
    } catch (err) {
      console.error('Delete tx error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const [year, month] = currentYearMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const monthlyTx = transactions.filter((t) => t.date.startsWith(currentYearMonth))

  const dayMap = new Map<string, { expense: number; income: number; txs: Transaction[] }>()
  monthlyTx.forEach((tx) => {
    const cur = dayMap.get(tx.date) || { expense: 0, income: 0, txs: [] }
    if (tx.type === 'expense') cur.expense += tx.amount
    else if (tx.type === 'income') cur.income += tx.amount
    cur.txs.push(tx)
    dayMap.set(tx.date, cur)
  })

  const calendarCells = []
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYearMonth}-${String(d).padStart(2, '0')}`
    calendarCells.push({ day: d, dateStr, data: dayMap.get(dateStr) })
  }

  const selectedDayTxs = selectedDayDate ? dayMap.get(selectedDayDate)?.txs || [] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 月切替ヘッダー ── */}
      <div className="px-4">
        <div
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button className="chip" style={{ padding: '4px 12px', fontSize: 13 }} onClick={handlePrevMonth}>
            ◀ 前月
          </button>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800, color: 'white' }}>
            {year}年 {month}月
          </div>
          <button className="chip" style={{ padding: '4px 12px', fontSize: 13 }} onClick={handleNextMonth}>
            次月 ▶
          </button>
        </div>
      </div>

      {/* ── サブタブ切り替え ── */}
      <div className="px-4">
        <div className="type-toggle">
          <button className={`type-btn ${subTab === 'chart' ? 'active-expense' : ''}`} onClick={() => setSubTab('chart')}>
            📊 集計・円グラフ
          </button>
          <button className={`type-btn ${subTab === 'calendar' ? 'active-income' : ''}`} onClick={() => setSubTab('calendar')}>
            📅 カレンダー
          </button>
          <button className={`type-btn ${subTab === 'list' ? 'active-transfer' : ''}`} onClick={() => setSubTab('list')}>
            📝 明細リスト
          </button>
        </div>
      </div>

      {/* ── サマリーカード（収支計算付き） ── */}
      <div className="px-4">
        <div className="summary-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
            {year}年{month}月の収支計算
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 600 }}>収入</div>
              <div className="summary-amount income-color" style={{ fontSize: 15, marginTop: 2 }}>
                ¥{formatAmount(summary.totalIncome)}
              </div>
            </div>
            <div style={{ background: 'rgba(255, 107, 107, 0.1)', padding: '8px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 10, color: '#FF6B6B', fontWeight: 600 }}>支出</div>
              <div className="summary-amount expense-color" style={{ fontSize: 15, marginTop: 2 }}>
                ¥{formatAmount(summary.totalExpense)}
              </div>
            </div>
            <div style={{ background: summary.totalIncome - summary.totalExpense >= 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(239, 68, 68, 0.15)', padding: '8px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>収支差額</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  marginTop: 2,
                  color: summary.totalIncome - summary.totalExpense >= 0 ? 'var(--accent-purple)' : '#FF6B6B',
                }}
              >
                {summary.totalIncome - summary.totalExpense >= 0 ? '+' : ''}
                ¥{formatAmount(summary.totalIncome - summary.totalExpense)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB TAB 1: 集計 ＆ 円グラフ ── */}
      {subTab === 'chart' && (
        <div className="px-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
              カテゴリ別 支出割合
            </h3>
            
            {/* 円グラフ上の収支ハイライト */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                background: 'var(--bg-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                marginBottom: 16,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>当月収入</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>¥{formatAmount(summary.totalIncome)}</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>-</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>当月支出</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#FF6B6B' }}>¥{formatAmount(summary.totalExpense)}</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>=</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>収支</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: summary.totalIncome - summary.totalExpense >= 0 ? 'var(--accent-purple)' : '#FF6B6B',
                  }}
                >
                  {summary.totalIncome - summary.totalExpense >= 0 ? '+' : ''}¥{formatAmount(summary.totalIncome - summary.totalExpense)}
                </div>
              </div>
            </div>

            <DonutChart data={summary.byCategory} totalExpense={summary.totalExpense} />
          </div>

          {summary.byCategory.length > 0 && (
            <div className="glass-card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
                支出カテゴリの内訳
              </h4>
              {summary.byCategory.map((item) => (
                <div key={item.category?.id || item.category?.name} className="cat-bar-row">
                  <div className="cat-bar-label">
                    {item.category?.icon} {item.category?.name}
                  </div>
                  <div className="cat-bar-track">
                    <div
                      className="cat-bar-fill"
                      style={{
                        width: `${item.percentage}%`,
                        background: item.category?.color || 'var(--accent-purple)',
                      }}
                    />
                  </div>
                  <div className="cat-bar-amount">¥{formatAmount(item.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUB TAB 2: カレンダー表示 ── */}
      {subTab === 'calendar' && (
        <div className="px-4">
          <div className="glass-card" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 8, fontSize: 11, fontWeight: 700 }}>
              <span style={{ color: '#FF6B6B' }}>日</span>
              <span>月</span>
              <span>火</span>
              <span>水</span>
              <span>木</span>
              <span>金</span>
              <span style={{ color: '#3B82F6' }}>土</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} style={{ height: 52 }} />
                }
                const hasExpense = (cell.data?.expense ?? 0) > 0
                const hasIncome = (cell.data?.income ?? 0) > 0

                return (
                  <button
                    key={cell.dateStr}
                    style={{
                      height: 54,
                      background: cell.data ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-glass)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedDayDate(cell.dateStr)}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>{cell.day}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 1 }}>
                      {hasExpense && (
                        <span style={{ fontSize: 9, color: '#FF6B6B', fontWeight: 700, lineHeight: 1 }}>
                          -{cell.data!.expense.toLocaleString('ja-JP')}
                        </span>
                      )}
                      {hasIncome && (
                        <span style={{ fontSize: 9, color: '#34D399', fontWeight: 700, lineHeight: 1 }}>
                          +{cell.data!.income.toLocaleString('ja-JP')}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SUB TAB 3: 明細リスト ── */}
      {subTab === 'list' && (
        <div className="tx-list">
          {monthlyTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              {year}年{month}月の明細データはありません
            </div>
          ) : (
            monthlyTx.map((tx) => (
              <div key={tx.id} className="tx-item" onClick={() => setEditingTx(tx)}>
                <div
                  className="tx-icon"
                  style={{
                    background: tx.category?.color ? `${tx.category.color}25` : 'var(--bg-glass)',
                    color: tx.category?.color || 'var(--text-primary)',
                  }}
                >
                  {tx.category?.icon || (tx.type === 'income' ? '💰' : '💸')}
                </div>
                <div className="tx-info">
                  <div className="tx-cat">
                    {tx.category?.name || (tx.type === 'income' ? '収入' : '未分類')}
                    {tx.subcategory && <span style={{ color: 'var(--accent-pink)', fontSize: 11, marginLeft: 6 }}>({tx.subcategory.name})</span>}
                  </div>
                  <div className="tx-meta">
                    {tx.date} • {tx.payment_method?.name || '現金'} {tx.memo && `• ${tx.memo}`}
                  </div>
                </div>
                <div className={`tx-amount ${tx.type}`}>
                  {tx.type === 'expense' ? '-' : '+'}¥{formatAmount(tx.amount)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="tx-delete-btn"
                    style={{ color: 'var(--accent-purple)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingTx(tx)
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="tx-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDeleteTx(tx)
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── カレンダー日付詳細モーダル ── */}
      {selectedDayDate && (
        <div className="modal-overlay" onClick={() => setSelectedDayDate(null)}>
          <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                {selectedDayDate} の記録
              </h3>
              <button className="chip" style={{ padding: '4px 10px' }} onClick={() => setSelectedDayDate(null)}>
                ✕
              </button>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', padding: 12, fontSize: 14, marginBottom: 16 }}
              onClick={() => {
                const date = selectedDayDate
                setSelectedDayDate(null)
                onNavigateToInputWithDate(date)
              }}
            >
              ＋ この日 ({selectedDayDate}) に記録する
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '40vh', overflowY: 'auto' }}>
              {selectedDayTxs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                  この日の記録はありません
                </div>
              ) : (
                selectedDayTxs.map((tx) => (
                  <div key={tx.id} className="tx-item" style={{ padding: 10 }} onClick={() => setEditingTx(tx)}>
                    <span style={{ fontSize: 20 }}>{tx.category?.icon || '💸'}</span>
                    <div className="tx-info">
                      <div className="tx-cat" style={{ fontSize: 13 }}>
                        {tx.category?.name || '未分類'}
                        {tx.subcategory && <span style={{ fontSize: 11, color: 'var(--accent-pink)', marginLeft: 4 }}>({tx.subcategory.name})</span>}
                      </div>
                      <div className="tx-meta" style={{ fontSize: 10 }}>{tx.payment_method?.name} {tx.memo && `• ${tx.memo}`}</div>
                    </div>
                    <div className={`tx-amount ${tx.type}`} style={{ fontSize: 14 }}>
                      {tx.type === 'expense' ? '-' : '+'}¥{formatAmount(tx.amount)}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="tx-delete-btn"
                        style={{ padding: '4px 6px', fontSize: 12, color: 'var(--accent-purple)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTx(tx)
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="tx-delete-btn"
                        style={{ padding: '4px 6px', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDeleteTx(tx)
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ✏️ 編集モーダル ── */}
      <EditTransactionModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
        categories={categories}
        subcategories={subcategories}
        paymentMethods={paymentMethods}
        onUpdated={onUpdated}
        onRefreshMaster={onRefreshMaster}
      />

      {/* ── 🛡️ 安全削除確認モーダル ── */}
      {pendingDeleteTx && (
        <div className="modal-overlay" onClick={() => setPendingDeleteTx(null)}>
          <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()} style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>記録を削除しますか？</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              {pendingDeleteTx.date} 【{pendingDeleteTx.category?.name || '未分類'}】
              <br />
              <strong style={{ fontSize: 16, color: pendingDeleteTx.type === 'expense' ? '#FF6B6B' : '#34D399' }}>
                {pendingDeleteTx.type === 'expense' ? '-' : '+'}¥{formatAmount(pendingDeleteTx.amount)}
              </strong>
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="chip"
                style={{ flex: 1, padding: '12px', fontSize: 14, justifyContent: 'center' }}
                onClick={() => setPendingDeleteTx(null)}
              >
                キャンセル
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#EF4444',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
                disabled={deletingId === pendingDeleteTx.id}
                onClick={confirmDelete}
              >
                {deletingId === pendingDeleteTx.id ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
