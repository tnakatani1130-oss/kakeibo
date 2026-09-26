'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Category, Subcategory, PaymentMethod, NewTransaction, TransactionType } from '@/types'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────
// 日付ユーティリティ
// ─────────────────────────────────────────
function toJST(date: Date): string {
  return date.toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' }) // "YYYY-MM-DD"
}

function todayJST(): string {
  return toJST(new Date())
}

function yesterdayJST(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toJST(d)
}

// ─────────────────────────────────────────
// サブコンポーネント: Backspace SVG
// ─────────────────────────────────────────
function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  )
}

// ─────────────────────────────────────────
// Props
// ─────────────────────────────────────────
interface QuickInputProps {
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  userId: string
  onSaved: () => void
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export default function QuickInput({
  categories,
  subcategories,
  paymentMethods,
  userId,
  onSaved,
}: QuickInputProps) {
  const supabase = createClient()

  // State
  const [amountStr, setAmountStr] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedPayId, setSelectedPayId] = useState<string | null>(() =>
    paymentMethods[0]?.id ?? null
  )
  const [selectedDate, setSelectedDate] = useState<string>(todayJST())
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; show: boolean; ok: boolean }>({
    msg: '',
    show: false,
    ok: true,
  })

  // 大カテゴリを変えたら中カテゴリをリセット
  useEffect(() => {
    setSelectedSubId(null)
  }, [selectedCatId])

  // 表示する中カテゴリ
  const filteredSubs = subcategories.filter(
    (s) => s.category_id === selectedCatId
  )

  // ─────────────────────────────────────────
  // Keypad logic
  // ─────────────────────────────────────────
  const pressKey = useCallback((key: string) => {
    setAmountStr((prev) => {
      if (key === 'DEL') return prev.slice(0, -1)
      if (prev.length >= 8) return prev // 最大8桁
      if (key === '0' && prev === '') return '' // leading zero禁止
      if (key === '00' && prev === '') return ''
      return prev + key
    })
  }, [])

  const amountNum = parseInt(amountStr || '0', 10)
  const formattedAmount = amountNum === 0
    ? '0'
    : amountNum.toLocaleString('ja-JP')

  // ─────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────
  const handleSave = async () => {
    if (amountNum <= 0) {
      showToast('金額を入力してください', false)
      return
    }

    setSaving(true)
    try {
      const tx: NewTransaction & { user_id: string } = {
        user_id: userId,
        date: selectedDate,
        type,
        amount: amountNum,
        category_id: selectedCatId,
        subcategory_id: selectedSubId,
        payment_method_id: selectedPayId,
        memo,
      }

      const { error } = await supabase.from('transactions').insert(tx)
      if (error) {
        console.error('Supabase Insert Error:', error)
        throw error
      }

      // Reset form
      setAmountStr('')
      setMemo('')
      showToast('💾 保存しました！', true)
      onSaved()
    } catch (err: any) {
      console.error(err)
      const errMsg = err?.message || '保存に失敗しました'
      showToast(`保存失敗: ${errMsg}`, false)
    } finally {
      setSaving(false)
    }

  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, show: true, ok })
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2200)
  }

  const isToday = selectedDate === todayJST()
  const isYesterday = selectedDate === yesterdayJST()

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.ok ? 'success' : ''}`}>
        {toast.msg}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ── 収支タイプ切り替え ── */}
        <div className="px-4">
          <div className="type-toggle">
            <button
              id="type-expense"
              className={`type-btn ${type === 'expense' ? 'active-expense' : ''}`}
              onClick={() => setType('expense')}
            >
              支出
            </button>
            <button
              id="type-income"
              className={`type-btn ${type === 'income' ? 'active-income' : ''}`}
              onClick={() => setType('income')}
            >
              収入
            </button>
            <button
              id="type-transfer"
              className={`type-btn ${type === 'transfer' ? 'active-transfer' : ''}`}
              onClick={() => setType('transfer')}
            >
              振替
            </button>
          </div>
        </div>

        {/* ── 金額表示 ── */}
        <div
          className={`amount-display${type === 'income' ? ' income' : ''}${amountStr === '' ? ' placeholder' : ''}`}
        >
          <span>¥{formattedAmount}</span>
        </div>

        {/* ── 日付ピル ── */}
        <div className="date-pills">
          <button
            id="date-today"
            className={`date-pill ${isToday ? 'selected' : ''}`}
            onClick={() => setSelectedDate(todayJST())}
          >
            今日
          </button>
          <button
            id="date-yesterday"
            className={`date-pill ${isYesterday ? 'selected' : ''}`}
            onClick={() => setSelectedDate(yesterdayJST())}
          >
            昨日
          </button>
          <div className={`date-pill ${!isToday && !isYesterday ? 'selected' : ''}`}>
            <input
              type="date"
              id="date-custom"
              value={selectedDate}
              max={todayJST()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* ── 大カテゴリ ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="section-label">カテゴリ</span>
          <div className="chip-scroll">
            {categories.map((cat) => (
              <button
                key={cat.id}
                id={`cat-${cat.id}`}
                className={`chip ${selectedCatId === cat.id ? 'selected' : ''}`}
                onClick={() =>
                  setSelectedCatId(selectedCatId === cat.id ? null : cat.id)
                }
                style={
                  selectedCatId === cat.id && cat.color
                    ? {
                        borderColor: cat.color,
                        background: `${cat.color}20`,
                        color: cat.color,
                      }
                    : {}
                }
              >
                {cat.icon && <span className="chip-icon">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── 中カテゴリ (選択中の大カテゴリがある場合のみ表示) ── */}
        {filteredSubs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="section-label">サブカテゴリ</span>
            <div className="chip-scroll">
              {filteredSubs.map((sub) => (
                <button
                  key={sub.id}
                  id={`sub-${sub.id}`}
                  className={`chip ${selectedSubId === sub.id ? 'selected' : ''}`}
                  onClick={() =>
                    setSelectedSubId(selectedSubId === sub.id ? null : sub.id)
                  }
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 支払い方法 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="section-label">支払い方法</span>
          <div className="chip-scroll">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                id={`pay-${pm.id}`}
                className={`chip ${selectedPayId === pm.id ? 'selected' : ''}`}
                onClick={() => setSelectedPayId(pm.id)}
              >
                {pm.icon && <span className="chip-icon">{pm.icon}</span>}
                {pm.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── メモ ── */}
        <div className="px-4">
          <input
            id="memo-input"
            type="text"
            className="memo-input"
            placeholder="メモ・店名など（任意）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* ── 数字キーパッド ── */}
        <div className="keypad">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
            <button
              key={k}
              id={`key-${k}`}
              className="key-btn"
              onClick={() => pressKey(k)}
            >
              {k}
            </button>
          ))}
          <button id="key-00" className="key-btn key-zero" onClick={() => pressKey('00')}>
            00
          </button>
          <button id="key-0" className="key-btn" onClick={() => pressKey('0')}>
            0
          </button>
          <button id="key-del" className="key-btn key-delete" onClick={() => pressKey('DEL')}>
            <BackspaceIcon />
          </button>
        </div>

        {/* ── 保存ボタン ── */}
        <div className="px-4" style={{ paddingBottom: '8px' }}>
          <button
            id="save-btn"
            className={`save-btn${type === 'income' ? ' income-btn' : ''}`}
            onClick={handleSave}
            disabled={saving || amountNum <= 0}
          >
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="spinner" />
                保存中...
              </span>
            ) : (
              `${type === 'expense' ? '支出' : type === 'income' ? '収入' : '振替'}を記録する`
            )}
          </button>
        </div>
      </div>
    </>
  )
}
