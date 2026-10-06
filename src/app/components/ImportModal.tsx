'use client'

import { useState, useCallback, useRef } from 'react'
import type { Category, Subcategory, PaymentMethod } from '@/types'
import { createClient } from '@/lib/supabase'

// ============================================================
// CSVパース
// ============================================================

interface ParsedRow {
  raw_date: string
  date: string
  description: string
  amount: number
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  memo: string
  skip: boolean
  isDuplicate?: boolean
  duplicateReason?: 'already_saved' | 'in_file'
  matchedExistingMemo?: string | null
}

function parseYYMMDD(raw: string): string {
  const s = raw.trim()
  if (s.length === 6) {
    const yy = parseInt(s.slice(0, 2), 10)
    const mm = s.slice(2, 4)
    const dd = s.slice(4, 6)
    const yyyy = yy + 2000
    return `${yyyy}-${mm}-${dd}`
  }
  return ''
}

function decodeShiftJIS(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('shift-jis')
  return decoder.decode(buffer)
}

function normalizeStr(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

function parseCSV(text: string): Omit<ParsedRow, 'isDuplicate' | 'duplicateReason'>[] {
  const lines = text.split(/\r?\n/)
  const rows: Omit<ParsedRow, 'isDuplicate' | 'duplicateReason'>[] = []
  for (const line of lines) {
    const cols = line.split(',')
    if (cols.length < 7) continue
    const rawDate = cols[0].trim()
    if (!/^\d{6}$/.test(rawDate)) continue
    const date = parseYYMMDD(rawDate)
    if (!date) continue
    const description = cols[2].trim()
    const amountStr = cols[6].trim().replace(/,/g, '')
    const amount = parseInt(amountStr, 10)
    if (isNaN(amount) || amount <= 0) continue
    rows.push({
      raw_date: rawDate,
      date,
      description,
      amount,
      category_id: null,
      subcategory_id: null,
      payment_method_id: null,
      memo: description,
      skip: false,
    })
  }
  return rows
}

// ============================================================
// Props
// ============================================================

interface ImportModalProps {
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  userId: string
  onClose: () => void
  onImported: () => void
}

// ============================================================
// Icons
// ============================================================

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function ImportModal({
  categories,
  subcategories,
  paymentMethods,
  userId,
  onClose,
  onImported,
}: ImportModalProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expenseCategories = categories.filter(c => c.type === 'expense' || !c.type)

  const processFile = useCallback(async (file: File) => {
    setError(null)
    setSavedCount(null)
    setFileName(file.name)
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const text = decodeShiftJIS(buffer)
      const rawParsed = parseCSV(text)
      if (rawParsed.length === 0) {
        setError('有効なデータが見つかりませんでした。CSVの形式を確認してください。')
        return
      }

      // 既存データの取得（日付範囲で絞り込み）
      const validDates = rawParsed.map(r => r.date).filter(Boolean).sort()
      const minDate = validDates[0]
      const maxDate = validDates[validDates.length - 1]

      let existingList: { date: string; amount: number; rawMemo: string | null; memoNorm: string; matched: boolean }[] = []
      if (minDate && maxDate) {
        const { data: dbData, error: dbErr } = await supabase
          .from('transactions')
          .select('date, amount, memo')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .gte('date', minDate)
          .lte('date', maxDate)

        if (!dbErr && dbData) {
          existingList = dbData.map(d => ({
            date: d.date,
            amount: d.amount,
            rawMemo: d.memo,
            memoNorm: normalizeStr(d.memo),
            matched: false,
          }))
        }
      }

      // 重複判定処理（1. 既存DBとの突合, 2. CSV内の重複行検知）
      const seenCsvKeys = new Map<string, number>()
      const evaluatedRows: ParsedRow[] = rawParsed.map(r => {
        const descNorm = normalizeStr(r.description)

        // 1. 既存DBレコードとの突合 (日付 + 金額が一致するもの)
        // ① まずメモ/店名が一致または包含するものを最優先でマッチ
        let matchIdx = existingList.findIndex(
          d => !d.matched &&
               d.date === r.date &&
               d.amount === r.amount &&
               (d.memoNorm === descNorm ||
                (d.memoNorm && descNorm && (d.memoNorm.includes(descNorm) || descNorm.includes(d.memoNorm))))
        )

        // ② メモ完全一致がなければ、同日同額の未マッチレコードとマッチ（手動登録でメモが未入力や別名義の場合も検出）
        if (matchIdx === -1) {
          matchIdx = existingList.findIndex(
            d => !d.matched &&
                 d.date === r.date &&
                 d.amount === r.amount
          )
        }

        if (matchIdx !== -1) {
          existingList[matchIdx].matched = true
          const matchedItem = existingList[matchIdx]
          return {
            ...r,
            isDuplicate: true,
            duplicateReason: 'already_saved' as const,
            matchedExistingMemo: matchedItem.rawMemo,
            skip: true, // 既に登録済みなので初期状態でスキップ
          }
        }

        // 2. CSVファイル内での先行行との重複検知
        const key = `${r.date}|${r.amount}|${descNorm}`
        const count = seenCsvKeys.get(key) || 0
        seenCsvKeys.set(key, count + 1)
        if (count > 0) {
          return {
            ...r,
            isDuplicate: true,
            duplicateReason: 'in_file' as const,
            skip: true, // ファイル内重複なので初期状態でスキップ
          }
        }

        return {
          ...r,
          isDuplicate: false,
          skip: false,
        }
      })

      setRows(evaluatedRows)
    } catch {
      setError('ファイルの読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) processFile(file)
  }, [processFile])

  const updateRow = useCallback((index: number, patch: Partial<ParsedRow>) => {
    setRows(prev => {
      if (!prev) return prev
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      if ('category_id' in patch) {
        next[index].subcategory_id = null
      }
      return next
    })
  }, [])

  // 重複行の一括切り替え（一括スキップ / 一括選択）
  const toggleAllDuplicates = useCallback((skipState: boolean) => {
    setRows(prev => {
      if (!prev) return prev
      return prev.map(r => r.isDuplicate ? { ...r, skip: skipState } : r)
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!rows) return
    setSaving(true)
    setError(null)
    try {
      const toInsert = rows
        .filter(r => !r.skip)
        .map(r => ({
          user_id: userId,
          date: r.date,
          type: 'expense' as const,
          amount: r.amount,
          category_id: r.category_id || null,
          subcategory_id: r.subcategory_id || null,
          payment_method_id: r.payment_method_id || null,
          memo: r.memo || r.description,
        }))

      if (toInsert.length === 0) {
        setError('保存する行がありません（重複分またはすべての行がスキップされています）。')
        setSaving(false)
        return
      }

      const { error: dbError } = await supabase.from('transactions').insert(toInsert)
      if (dbError) throw dbError

      setSavedCount(toInsert.length)
      setTimeout(() => {
        onImported()
        onClose()
      }, 1500)
    } catch (e: unknown) {
      setError(`保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }, [rows, userId, supabase, onImported, onClose])

  const activeRows = rows?.filter(r => !r.skip) ?? []
  const duplicateRows = rows?.filter(r => r.isDuplicate) ?? []
  const duplicateSkippedCount = duplicateRows.filter(r => r.skip).length
  const totalAmount = activeRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '92dvh',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #12121a 100%)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(139,92,246,0.2)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              📂 CSVインポート
            </div>
            {fileName && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fileName}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* スクロールエリア */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>

          {/* ローディング */}
          {loading && (
            <div style={{
              padding: '30px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: 'var(--text-secondary)',
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid rgba(139,92,246,0.2)',
                borderTopColor: 'var(--accent-purple)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <div style={{ fontSize: 13 }}>ファイルを解析し、登録済みデータとの重複を確認中...</div>
            </div>
          )}

          {/* ファイルアップロードエリア */}
          {!rows && !loading && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent-purple)' : 'rgba(139,92,246,0.3)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isDragging ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.03)',
                marginBottom: 16,
              }}
            >
              <div style={{ color: 'var(--accent-purple)', marginBottom: 12 }}>
                <UploadIcon />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--text-primary)' }}>
                CSVファイルをドロップ
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                または<span style={{ color: 'var(--accent-purple)' }}>クリックして選択</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Shift-JIS形式のCSVに対応（重複分は自動で除外されます）
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* エラー */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: 13,
              color: '#fca5a5',
              marginBottom: 12,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 保存完了 */}
          {savedCount !== null && (
            <div style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: 13,
              color: '#6ee7b7',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              {savedCount}件のデータを保存しました！
            </div>
          )}

          {/* プレビュー一覧 */}
          {rows && rows.length > 0 && (
            <>
              {/* サマリーカード */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>保存対象</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--accent-purple)' }}>
                    {activeRows.length}<span style={{ fontSize: 12, fontWeight: 500 }}>件</span>
                  </div>
                </div>

                {duplicateRows.length > 0 && (
                  <div style={{
                    flex: 1,
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 2 }}>重複除外</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                      {duplicateSkippedCount}<span style={{ fontSize: 12, fontWeight: 500 }}>件</span>
                    </div>
                  </div>
                )}

                <div style={{
                  flex: 1.2,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>合計金額</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: '#f87171' }}>
                    ¥{totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 重複除外のアラート・一括操作ボタン */}
              {duplicateRows.length > 0 && (
                <div style={{
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.4 }}>
                    ⚠️ {duplicateRows.length}件の重複を検出しました（自動で除外中）
                  </div>
                  {duplicateSkippedCount > 0 ? (
                    <button
                      onClick={() => toggleAllDuplicates(false)}
                      style={{
                        background: 'rgba(245,158,11,0.2)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fbbf24',
                        fontSize: 10,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      重複も含める
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAllDuplicates(true)}
                      style={{
                        background: 'rgba(245,158,11,0.2)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fbbf24',
                        fontSize: 10,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      重複を除外する
                    </button>
                  )}
                </div>
              )}

              {/* ファイル再選択ボタン */}
              <button
                onClick={() => { setRows(null); setFileName(''); setError(null) }}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  marginBottom: 12,
                }}
              >
                📁 別のファイルを選択
              </button>

              {/* 行一覧 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                {rows.map((row, i) => (
                  <ImportRow
                    key={i}
                    index={i}
                    row={row}
                    categories={expenseCategories}
                    subcategories={subcategories}
                    paymentMethods={paymentMethods}
                    onChange={updateRow}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* フッター保存ボタン */}
        {rows && rows.length > 0 && (
          <div style={{
            padding: '12px 16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            background: 'rgba(12,12,22,0.8)',
          }}>
            <button
              onClick={handleSave}
              disabled={saving || activeRows.length === 0}
              style={{
                width: '100%',
                padding: '14px',
                background: saving || activeRows.length === 0
                  ? 'rgba(139,92,246,0.3)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                color: 'white',
                fontFamily: 'var(--font-heading)',
                fontSize: 15,
                fontWeight: 700,
                cursor: saving || activeRows.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              {saving ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <span>保存中...</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckIcon />
                    <span>{activeRows.length}件を支出として保存</span>
                  </div>
                  {rows.length > activeRows.length && (
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>
                      （重複・スキップ {rows.length - activeRows.length}件を除外）
                    </div>
                  )}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ImportRow コンポーネント
// ============================================================

interface ImportRowProps {
  index: number
  row: ParsedRow
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  onChange: (index: number, patch: Partial<ParsedRow>) => void
}

function ImportRow({ index, row, categories, subcategories, paymentMethods, onChange }: ImportRowProps) {
  const [expanded, setExpanded] = useState(false)

  const rowSubcategories = subcategories.filter(s => s.category_id === row.category_id)
  const selectedCategory = categories.find(c => c.id === row.category_id)
  const selectedSubcat = subcategories.find(s => s.id === row.subcategory_id)
  const selectedPm = paymentMethods.find(p => p.id === row.payment_method_id)

  const dateDisplay = row.date ? (() => {
    const [, m, d] = row.date.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  })() : ''

  return (
    <div style={{
      background: row.skip ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${
        row.isDuplicate && row.skip
          ? 'rgba(245,158,11,0.25)'
          : row.skip
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.08)'
      }`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      opacity: row.skip ? 0.45 : 1,
      transition: 'all 0.2s ease',
    }}>
      {/* メイン行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => !row.skip && setExpanded(e => !e)}
      >
        {/* スキップチェックボックス */}
        <button
          onClick={e => { e.stopPropagation(); onChange(index, { skip: !row.skip }) }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `2px solid ${row.skip ? 'rgba(255,255,255,0.2)' : 'var(--accent-purple)'}`,
            background: row.skip ? 'transparent' : 'rgba(139,92,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'var(--accent-purple)',
            transition: 'all 0.15s ease',
          }}
        >
          {!row.skip && <CheckIcon />}
        </button>

        {/* 日付 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 34, flexShrink: 0 }}>
          {dateDisplay}
        </div>

        {/* 重複バッジ */}
        {row.isDuplicate && (
          <span style={{
            fontSize: 10,
            padding: '2px 5px',
            borderRadius: 4,
            background: row.duplicateReason === 'already_saved' ? 'rgba(245,158,11,0.18)' : 'rgba(168,85,247,0.18)',
            color: row.duplicateReason === 'already_saved' ? '#fbbf24' : '#c084fc',
            border: `1px solid ${row.duplicateReason === 'already_saved' ? 'rgba(245,158,11,0.35)' : 'rgba(168,85,247,0.35)'}`,
            flexShrink: 0,
            fontWeight: 600,
          }}>
            {row.duplicateReason === 'already_saved' ? '登録済' : 'CSV内重複'}
          </span>
        )}

        {/* 店名と重複詳細 */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description}
          </div>
          {row.isDuplicate && row.duplicateReason === 'already_saved' && (
            <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              既存データ: {row.matchedExistingMemo ? `「${row.matchedExistingMemo}」` : '同日・同額の支出あり'}
            </div>
          )}
        </div>

        {/* カテゴリバッジ */}
        {selectedCategory && (
          <div style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 'var(--radius-full)',
            background: `${selectedCategory.color}22`,
            color: selectedCategory.color ?? 'var(--text-muted)',
            border: `1px solid ${selectedCategory.color}44`,
            flexShrink: 0,
            maxWidth: 72,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedCategory.icon} {selectedCategory.name}
          </div>
        )}

        {/* 金額 */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', flexShrink: 0, fontFamily: 'var(--font-heading)' }}>
          ¥{row.amount.toLocaleString()}
        </div>

        {/* 展開矢印 */}
        {!row.skip && (
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 10,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}>▼</div>
        )}
      </div>

      {/* 展開：編集エリア */}
      {expanded && !row.skip && (
        <div style={{
          padding: '0 12px 12px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {/* メモ */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>メモ</label>
            <input
              type="text"
              value={row.memo}
              onChange={e => onChange(index, { memo: e.target.value })}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          {/* カテゴリ */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>カテゴリ</label>
            <select
              value={row.category_id ?? ''}
              onChange={e => onChange(index, { category_id: e.target.value || null })}
              style={{
                width: '100%',
                background: '#1e1e2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">未分類</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* サブカテゴリ */}
          {rowSubcategories.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>サブカテゴリ</label>
              <select
                value={row.subcategory_id ?? ''}
                onChange={e => onChange(index, { subcategory_id: e.target.value || null })}
                style={{
                  width: '100%',
                  background: '#1e1e2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">未選択</option>
                {rowSubcategories.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 支払い方法 */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>支払い方法</label>
            <select
              value={row.payment_method_id ?? ''}
              onChange={e => onChange(index, { payment_method_id: e.target.value || null })}
              style={{
                width: '100%',
                background: '#1e1e2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">未選択</option>
              {paymentMethods.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>

          {/* 選択済みタグ表示 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {selectedSubcat && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.3)' }}>
                {selectedSubcat.name}
              </span>
            )}
            {selectedPm && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                {selectedPm.icon} {selectedPm.name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
