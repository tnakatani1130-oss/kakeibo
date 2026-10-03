'use client'

import { useState, useEffect } from 'react'
import type { Transaction, Category, Subcategory, PaymentMethod, TransactionType } from '@/types'
import { createClient } from '@/lib/supabase'
import CategoryModal from './CategoryModal'
import PaymentModal from './PaymentModal'

interface EditTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction | null
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  onUpdated: () => void
  onRefreshMaster: () => void
}

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  categories,
  subcategories,
  paymentMethods,
  onUpdated,
  onRefreshMaster,
}: EditTransactionModalProps) {
  const supabase = createClient()

  const [date, setDate] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [amountStr, setAmountStr] = useState('')
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedPayId, setSelectedPayId] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [updating, setUpdating] = useState(false)

  // Sub-modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date)
      setType(transaction.type)
      setAmountStr(String(transaction.amount))
      setSelectedCatId(transaction.category_id)
      setSelectedSubId(transaction.subcategory_id)
      setSelectedPayId(transaction.payment_method_id)
      setMemo(transaction.memo || '')
    }
  }, [transaction])

  if (!isOpen || !transaction) return null

  const currentCat = categories.find((c) => c.id === selectedCatId)
  const currentSub = subcategories.find((s) => s.id === selectedSubId)
  const currentPay = paymentMethods.find((p) => p.id === selectedPayId)

  const handleUpdate = async () => {
    const amountNum = parseInt(amountStr || '0', 10)
    if (amountNum <= 0) {
      alert('金額を入力してください')
      return
    }

    setUpdating(true)
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          date,
          type,
          amount: amountNum,
          category_id: selectedCatId,
          subcategory_id: selectedSubId,
          payment_method_id: selectedPayId,
          memo,
        })
        .eq('id', transaction.id)

      if (error) throw error

      onUpdated()
      onClose()
    } catch (err: any) {
      console.error('Update error:', err)
      alert(`更新に失敗しました: ${err?.message || 'エラー'}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          {/* ヘッダー */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>✏️ 記録を修正</h3>
            <button className="chip" style={{ padding: '6px 10px' }} onClick={onClose}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 収支タイプ切替 */}
            <div className="type-toggle">
              <button
                className={`type-btn ${type === 'expense' ? 'active-expense' : ''}`}
                onClick={() => {
                  setType('expense')
                  setSelectedCatId(null)
                  setSelectedSubId(null)
                }}
              >
                支出
              </button>
              <button
                className={`type-btn ${type === 'income' ? 'active-income' : ''}`}
                onClick={() => {
                  setType('income')
                  setSelectedCatId(null)
                  setSelectedSubId(null)
                }}
              >
                収入
              </button>

            </div>

            {/* 日付 */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>日付</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-glass)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: 14,
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>

            {/* 金額 */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>金額 (円)</div>
              <div
                style={{
                  background: 'var(--bg-glass)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                <span>¥</span>
                <input
                  type="number"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            {/* カテゴリ ＆ 支払い方法選択 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setIsCatModalOpen(true)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: currentCat ? `${currentCat.color || '#8B5CF6'}20` : 'var(--bg-glass)',
                  border: `1.5px solid ${currentCat ? currentCat.color || 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>カテゴリ</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{currentCat ? currentCat.icon || '📁' : '📁'}</span>
                    <span>{currentCat ? currentCat.name : '選択'}</span>
                  </div>
                  {currentSub && type !== 'income' && (
                    <div style={{ fontSize: 10, color: 'var(--accent-pink)', marginTop: 2 }}>({currentSub.name})</div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
              </button>

              <button
                onClick={() => setIsPayModalOpen(true)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--bg-glass)',
                  border: `1.5px solid ${currentPay ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>支払い方法</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{currentPay ? currentPay.icon || '💳' : '💳'}</span>
                    <span>{currentPay ? currentPay.name : '選択'}</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▼</span>
              </button>
            </div>

            {/* メモ */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>メモ</div>
              <input
                type="text"
                className="memo-input"
                placeholder="メモ・店名など（任意）"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="chip" style={{ flex: 1, padding: 12, justifyContent: 'center' }} onClick={onClose}>
                キャンセル
              </button>
              <button
                className="btn-primary"
                style={{ flex: 2, padding: 12, fontSize: 15 }}
                disabled={updating}
                onClick={handleUpdate}
              >
                {updating ? '更新中...' : '💾 変更を保存する'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* サブモーダル */}
      <CategoryModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        categories={categories}
        subcategories={subcategories}
        selectedCatId={selectedCatId}
        selectedSubId={selectedSubId}
        txType={type}
        onSelect={(catId, subId) => {
          setSelectedCatId(catId)
          setSelectedSubId(subId)
        }}
        onRefresh={onRefreshMaster}
      />

      <PaymentModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        paymentMethods={paymentMethods}
        selectedPayId={selectedPayId}
        onSelect={(payId) => setSelectedPayId(payId)}
        onRefresh={onRefreshMaster}
      />
    </>
  )
}
