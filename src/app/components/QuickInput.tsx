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
  initialDate?: string
  onSaved: () => void
  onRefreshMaster: () => void
}


export default function QuickInput({
  categories,
  subcategories,
  paymentMethods,
  userId,
  initialDate,
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
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayJST())

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

        {/* 3. 【おカネレコ風 ヘッダー】電卓マーク ＆ 金額入力エリア */}
        <div className="px-4" style={{ marginTop: 4 }}>
          <div
            style={{
              background: 'var(--bg-glass)',
              border: `1.5px solid ${isCalcMode ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* 電卓マークボタン */}
            <button
              className={`chip ${isCalcMode ? 'selected' : ''}`}
              style={{
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 700,
                borderColor: isCalcMode ? 'var(--accent-pink)' : 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => {
                setIsCalcMode(!isCalcMode)
                setCalcFormula(amountStr)
              }}
              title="電卓モード切り替え"
            >
              🧮 {isCalcMode ? '電卓' : '電卓'}
            </button>

            {/* 金額入力エリア */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isCalcMode && calcFormula && (
                <div style={{ fontSize: 12, color: 'var(--accent-pink)', fontFamily: 'var(--font-heading)' }}>
                  {calcFormula} =
                </div>
              )}
              <div
                className={`amount-display${type === 'income' ? ' income' : ''}${amountStr === '' ? ' placeholder' : ''}`}
                style={{ minHeight: 'unset', padding: 0, justifyContent: 'flex-start', fontSize: 32 }}
              >
                <span style={{ marginRight: 4 }}>¥</span>
                <input
                  id="amount-direct-input"
                  type="number"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={amountStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '')
                    if (val.length <= 8) {
                      setAmountStr(val)
                    }
                  }}
                  placeholder="0"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    width: '100%',
                    caretColor: 'var(--accent-purple)',
                  }}
                />
              </div>
            </div>

            {/* ⌫ 削除ボタン */}
            {amountStr && (
              <button
                onClick={() => pressKey('DEL')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="1文字削除"
              >
                <BackspaceIcon />
              </button>
            )}
          </div>
        </div>

        {/* 隠しカメラファイルインプット */}
        <input
          id="camera-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              showToast('📷 レシート画像を添付しました', true)
            }
          }}
        />

        {/* 4. キーパッド (おカネレコ構成) */}
        {!isCalcMode ? (
          /* 通常テンキー (4列 × 4行構成) */
          <div className="keypad" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {/* 行 1 */}
            <button className="key-btn" onClick={() => pressKey('7')}>7</button>
            <button className="key-btn" onClick={() => pressKey('8')}>8</button>
            <button className="key-btn" onClick={() => pressKey('9')}>9</button>
            <button
              className="key-btn"
              style={{ fontSize: 13, flexDirection: 'column', gap: 2, color: 'var(--accent-purple)' }}
              onClick={() => {
                const el = document.getElementById('camera-file-input')
                if (el) el.click()
              }}
            >
              <span style={{ fontSize: 18 }}>📷</span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>カメラ</span>
            </button>

            {/* 行 2 */}
            <button className="key-btn" onClick={() => pressKey('4')}>4</button>
            <button className="key-btn" onClick={() => pressKey('5')}>5</button>
            <button className="key-btn" onClick={() => pressKey('6')}>6</button>
            <button
              className="key-btn"
              style={{ fontSize: 13, flexDirection: 'column', gap: 2, color: 'var(--accent-pink)' }}
              onClick={() => {
                const memoEl = document.getElementById('memo-input-field')
                if (memoEl) memoEl.focus()
              }}
            >
              <span style={{ fontSize: 18 }}>📝</span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>メモ</span>
            </button>

            {/* 行 3 */}
            <button className="key-btn" onClick={() => pressKey('1')}>1</button>
            <button className="key-btn" onClick={() => pressKey('2')}>2</button>
            <button className="key-btn" onClick={() => pressKey('3')}>3</button>
            {/* 「入力」ボタン（行3〜4を2段分スパン） */}
            <button
              className="key-btn"
              style={{
                gridRow: 'span 2',
                aspectRatio: 'unset',
                background: type === 'income' ? 'var(--gradient-income)' : 'var(--gradient-primary)',
                color: 'white',
                fontSize: 16,
                fontWeight: 800,
                border: 'none',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={handleSave}
              disabled={saving || amountNum <= 0}
            >
              {saving ? (
                <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              ) : (
                <>
                  <span style={{ fontSize: 20 }}>↵</span>
                  <span>入力</span>
                </>
              )}
            </button>

            {/* 行 4 */}
            <button className="key-btn" onClick={() => pressKey('00')}>00</button>
            <button className="key-btn" onClick={() => pressKey('0')}>0</button>
            <button className="key-btn" onClick={() => pressKey('.')}>.</button>
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

        {/* 5. ポップアップ選択（カテゴリ & 支払い方法） */}
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
                  小カテゴリ: {currentSub.name}
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

        {/* 5-2. 大カテゴリ選択時にそのすぐ下に現れる小カテゴリ（中カテゴリ）チップ */}
        {type !== 'income' && selectedCatId && (
          <div className="px-4" style={{ marginTop: -2 }}>
            <div
              style={{
                background: 'var(--bg-glass)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🏷️</span>
                <span>「{currentCat?.name}」の小カテゴリを選択</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflowX: 'auto',
                  paddingBottom: 2,
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <button
                  className={`chip ${selectedSubId === null ? 'selected' : ''}`}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    whiteSpace: 'nowrap',
                    borderColor: selectedSubId === null ? 'var(--accent-purple)' : 'var(--border-subtle)',
                  }}
                  onClick={() => setSelectedSubId(null)}
                >
                  指定なし（全般）
                </button>
                {subcategories
                  .filter((s) => s.category_id === selectedCatId)
                  .map((sub) => {
                    const isSelected = selectedSubId === sub.id
                    return (
                      <button
                        key={sub.id}
                        className={`chip ${isSelected ? 'selected' : ''}`}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          whiteSpace: 'nowrap',
                          borderColor: isSelected ? 'var(--accent-pink)' : 'var(--border-subtle)',
                          background: isSelected ? 'rgba(236, 72, 153, 0.25)' : 'var(--bg-glass)',
                          color: isSelected ? 'white' : 'var(--text-primary)',
                          fontWeight: isSelected ? 700 : 500,
                        }}
                        onClick={() => setSelectedSubId(sub.id)}
                      >
                        {sub.name}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* 6. メモ入力欄 */}
        <div className="px-4">
          <input
            id="memo-input-field"
            type="text"
            className="memo-input"
            placeholder="メモ・店名など（任意）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={100}
          />
        </div>

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
