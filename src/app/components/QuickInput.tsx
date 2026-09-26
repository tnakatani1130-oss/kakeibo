'use client'

import { useState, useCallback } from 'react'
import type { Category, Subcategory, PaymentMethod, NewTransaction, TransactionType } from '@/types'
import { createClient } from '@/lib/supabase'
import CategoryModal from './CategoryModal'
import PaymentModal from './PaymentModal'

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  )
}

function toJST(date: Date): string {
  return date.toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' })
}

function todayJST(): string {
  return toJST(new Date())
}

function yesterdayJST(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toJST(d)
}

interface QuickInputProps {
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  userId: string
  onSaved: () => void
  onRefreshMaster: () => void
}

export default function QuickInput({
  categories,
  subcategories,
  paymentMethods,
  userId,
  onSaved,
  onRefreshMaster,
}: QuickInputProps) {
  const supabase = createClient()

  // State
  const [amountStr, setAmountStr] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedPayId, setSelectedPayId] = useState<string | null>(() => paymentMethods[0]?.id ?? null)
  const [selectedDate, setSelectedDate] = useState<string>(todayJST())
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  // 電卓（計算機）モード State
  const [isCalcMode, setIsCalcMode] = useState(false)
  const [calcFormula, setCalcFormula] = useState('')

  // Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)

  const [toast, setToast] = useState<{ msg: string; show: boolean; ok: boolean }>({
    msg: '',
    show: false,
    ok: true,
  })

  // 通常テンキー入力
  const pressKey = useCallback((key: string) => {
    setAmountStr((prev) => {
      if (key === 'DEL') return prev.slice(0, -1)
      if (prev.length >= 8) return prev
      if (key === '0' && prev === '') return ''
      if (key === '00' && prev === '') return ''
      return prev + key
    })
  }, [])

  // 電卓モード計算キー
  const pressCalcKey = useCallback((key: string) => {
    if (key === 'C') {
      setCalcFormula('')
      setAmountStr('')
      return
    }
    if (key === 'DEL') {
      setCalcFormula((prev) => prev.slice(0, -1))
      return
    }
    if (key === '=') {
      try {
        // 安全な簡易計算評価 (加減乗除)
        const sanitized = calcFormula.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/.]/g, '')
        if (!sanitized) return
        const res = Math.floor(Function(`"use strict"; return (${sanitized})`)())
        if (!isNaN(res) && isFinite(res) && res >= 0) {
          setAmountStr(String(res))
          setCalcFormula(String(res))
        }
      } catch (err) {
        showToast('計算エラー', false)
      }
      return
    }
    setCalcFormula((prev) => prev + key)
  }, [calcFormula])

  const amountNum = parseInt(amountStr || '0', 10)
  const formattedAmount = amountNum === 0 ? '0' : amountNum.toLocaleString('ja-JP')

  // 選択中のマスタ
  const currentCat = categories.find((c) => c.id === selectedCatId)
  const currentSub = subcategories.find((s) => s.id === selectedSubId)
  const currentPay = paymentMethods.find((p) => p.id === selectedPayId)

  // 保存処理
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
      if (error) throw error

      setAmountStr('')
      setCalcFormula('')
      setMemo('')
      showToast('💾 保存しました！', true)
      onSaved()
    } catch (err: any) {
      console.error('Save error:', err)
      showToast(`保存失敗: ${err?.message || 'エラー'}`, false)
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

  return (
    <>
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.ok ? 'success' : ''}`}>
        {toast.msg}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 1. 収支タイプ切り替え */}
        <div className="px-4">
          <div className="type-toggle">
            <button className={`type-btn ${type === 'expense' ? 'active-expense' : ''}`} onClick={() => {
              setType('expense')
              setSelectedCatId(null)
              setSelectedSubId(null)
            }}>
              支出
            </button>
            <button className={`type-btn ${type === 'income' ? 'active-income' : ''}`} onClick={() => {
              setType('income')
              setSelectedCatId(null)
              setSelectedSubId(null)
            }}>
              収入
            </button>
            <button className={`type-btn ${type === 'transfer' ? 'active-transfer' : ''}`} onClick={() => setType('transfer')}>
              振替
            </button>
          </div>
        </div>

        {/* 2. 日付ピル */}
        <div className="date-pills">
          <button className={`date-pill ${isToday ? 'selected' : ''}`} onClick={() => setSelectedDate(todayJST())}>
            今日
          </button>
          <button className={`date-pill ${isYesterday ? 'selected' : ''}`} onClick={() => setSelectedDate(yesterdayJST())}>
            昨日
          </button>
          <div className={`date-pill ${!isToday && !isYesterday ? 'selected' : ''}`}>
            <input type="date" value={selectedDate} max={todayJST()} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </div>

        {/* 3. ポップアップ選択（カテゴリ & 支払い方法） */}
        <div className="px-4" style={{ display: 'flex', gap: 10 }}>
          {/* カテゴリ選択ボタン */}
          <button
            onClick={() => setIsCatModalOpen(true)}
            style={{
              flex: 1,
              padding: '12px 14px',
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
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                {type === 'income' ? '収入カテゴリ' : 'カテゴリ'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{currentCat ? currentCat.icon || '📁' : '📁'}</span>
                <span>{currentCat ? currentCat.name : '選択してください'}</span>
              </div>
              {currentSub && type !== 'income' && (
                <div style={{ fontSize: 11, color: 'var(--accent-pink)', marginTop: 2, fontWeight: 500 }}>
                  タグ: {currentSub.name}
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>▼</span>
          </button>

          {/* 支払い方法選択ボタン */}
          <button
            onClick={() => setIsPayModalOpen(true)}
            style={{
              flex: 1,
              padding: '12px 14px',
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
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{currentPay ? currentPay.icon || '💳' : '💳'}</span>
                <span>{currentPay ? currentPay.name : '選択'}</span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>▼</span>
          </button>
        </div>

        {/* 4. メモ入力欄 */}
        <div className="px-4">
          <input
            type="text"
            className="memo-input"
            placeholder="メモ・店名など（任意）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* 5. 【キーパッドのすぐ上に配置】金額表示 ＆ 電卓切替ボタン 🧮 */}
        <div className="px-4" style={{ marginTop: 4 }}>
          <div
            style={{
              background: 'var(--bg-glass)',
              border: `1.5px solid ${isCalcMode ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {isCalcMode && calcFormula && (
                <div style={{ fontSize: 12, color: 'var(--accent-pink)', fontFamily: 'var(--font-heading)' }}>
                  {calcFormula} =
                </div>
              )}
              <div
                className={`amount-display${type === 'income' ? ' income' : ''}${amountStr === '' ? ' placeholder' : ''}`}
                style={{ minHeight: 'unset', padding: 0, justifyContent: 'flex-start', fontSize: 36 }}
              >
                ¥{formattedAmount}
              </div>
            </div>

            {/* 電卓切替ボタン 🧮 */}
            <button
              className={`chip ${isCalcMode ? 'selected' : ''}`}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderColor: isCalcMode ? 'var(--accent-pink)' : 'var(--border-subtle)',
              }}
              onClick={() => {
                setIsCalcMode(!isCalcMode)
                setCalcFormula(amountStr)
              }}
            >
              🧮 {isCalcMode ? '通常' : '電卓'}
            </button>
          </div>
        </div>

        {/* 6. キーパッド (通常モード vs 電卓計算モード) */}
        {!isCalcMode ? (
          /* 通常テンキー */
          <div className="keypad">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
              <button key={k} className="key-btn" onClick={() => pressKey(k)}>
                {k}
              </button>
            ))}
            <button className="key-btn key-zero" onClick={() => pressKey('00')}>
              00
            </button>
            <button className="key-btn" onClick={() => pressKey('0')}>
              0
            </button>
            <button className="key-btn key-delete" onClick={() => pressKey('DEL')}>
              <BackspaceIcon />
            </button>
          </div>
        ) : (
          /* 電卓キーパッド (加減乗除 +, -, ×, ÷, =) */
          <div className="keypad" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-'].map((k) => (
              <button
                key={k}
                className="key-btn"
                style={['÷', '×', '-'].includes(k) ? { background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)' } : {}}
                onClick={() => pressCalcKey(k)}
              >
                {k}
              </button>
            ))}
            <button className="key-btn" style={{ color: '#FF6B6B' }} onClick={() => pressCalcKey('C')}>
              C
            </button>
            <button className="key-btn" onClick={() => pressCalcKey('0')}>
              0
            </button>
            <button className="key-btn" style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)' }} onClick={() => pressCalcKey('+')}>
              +
            </button>
            <button className="key-btn" style={{ background: 'var(--gradient-primary)', color: 'white', fontWeight: 800 }} onClick={() => pressCalcKey('=')}>
              =
            </button>
          </div>
        )}

        {/* 7. 記録するボタン */}
        <div className="px-4" style={{ paddingBottom: '8px' }}>
          <button
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

      {/* モーダルポップアップ */}
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
