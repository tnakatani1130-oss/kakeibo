'use client'

import { useState } from 'react'
import type { Transaction, Category, MonthlySummary } from '@/types'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatAmount(n: number): string {
  return n.toLocaleString('ja-JP')
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface DashboardProps {
  transactions: Transaction[]
  categories: Category[]
  summary: MonthlySummary
  onDeleted: () => void
}

// ─────────────────────────────────────────
// Category Bar
// ─────────────────────────────────────────
function CategoryBar({ item }: { item: MonthlySummary['byCategory'][number] }) {
  const color = item.category.color ?? '#8b5cf6'
  return (
    <div className="cat-bar-row">
      <div className="cat-bar-label">
        <span style={{ marginRight: 4 }}>{item.category.icon}</span>
        {item.category.name}
      </div>
      <div className="cat-bar-track">
        <div
          className="cat-bar-fill"
          style={{
            width: `${item.percentage}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
          }}
        />
      </div>
      <div className="cat-bar-amount">¥{formatAmount(item.total)}</div>
    </div>
  )
}

// ─────────────────────────────────────────
// Transaction Item
// ─────────────────────────────────────────
function TxItem({
  tx,
  onDelete,
}: {
  tx: Transaction
  onDelete: (id: string) => void
}) {
  const isExpense = tx.type === 'expense'
  const isIncome = tx.type === 'income'
  const catColor = tx.category?.color ?? '#8b5cf6'

  return (
    <div className="tx-item">
      <div
        className="tx-icon"
        style={{ background: `${catColor}20` }}
      >
        {tx.category?.icon ?? '💸'}
      </div>
      <div className="tx-info">
        <div className="tx-cat">
          {tx.category?.name ?? '未分類'}
          {tx.subcategory && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {' '}· {tx.subcategory.name}
            </span>
          )}
        </div>
        <div className="tx-meta">
          {formatDate(tx.date)}
          {tx.payment_method && ` · ${tx.payment_method.icon ?? ''}${tx.payment_method.name}`}
          {tx.memo && ` · ${tx.memo}`}
        </div>
      </div>
      <div className={`tx-amount ${isExpense ? 'expense' : isIncome ? 'income' : ''}`}>
        {isExpense ? '-' : isIncome ? '+' : ''}¥{formatAmount(tx.amount)}
      </div>
      <button
        id={`del-${tx.id}`}
        className="tx-delete-btn"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(tx.id)
        }}
        aria-label="削除"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─────────────────────────────────────────
// Delete Confirm Modal
// ─────────────────────────────────────────
function DeleteModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗑️</div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            この記録を削除しますか？
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            削除すると元に戻せません
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            id="cancel-delete-btn"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '14px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            id="confirm-delete-btn"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Dashboard (Main)
// ─────────────────────────────────────────
export default function Dashboard({
  transactions,
  categories: _categories,
  summary,
  onDeleted,
}: DashboardProps) {
  const supabase = createClient()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const balance = summary.totalIncome - summary.totalExpense

  const handleDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteTargetId)
      if (error) throw error
      setDeleteTargetId(null)
      onDeleted()
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {deleteTargetId && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
          deleting={deleting}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ── 今月サマリー ── */}
        <div style={{ padding: '0 16px' }}>
          <div className="summary-card">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                今月の支出
              </div>
              <div className="summary-amount expense-color">
                ¥{formatAmount(summary.totalExpense)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>収入</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: '#34d399' }}>
                  +¥{formatAmount(summary.totalIncome)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>収支</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: balance >= 0 ? '#34d399' : '#ff6b9d' }}>
                  {balance >= 0 ? '+' : ''}¥{formatAmount(balance)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── カテゴリ別グラフ ── */}
        {summary.byCategory.length > 0 && (
          <div style={{ padding: '0 16px' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
                カテゴリ別内訳
              </div>
              {summary.byCategory.map((item) => (
                <CategoryBar key={item.category.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* ── 履歴一覧 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="section-label" style={{ padding: '0 16px' }}>
            直近の記録 ({transactions.length}件)
          </span>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 14 }}>
              まだ記録がありません
            </div>
          ) : (
            <div className="tx-list">
              {transactions.map((tx) => (
                <TxItem
                  key={tx.id}
                  tx={tx}
                  onDelete={(id) => setDeleteTargetId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
