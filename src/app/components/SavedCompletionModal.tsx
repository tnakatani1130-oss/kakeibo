'use client'

import React from 'react'
import type { Transaction, Category, Subcategory, PaymentMethod } from '@/types'

interface SavedCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction | null
  categories: Category[]
  subcategories: Subcategory[]
  paymentMethods: PaymentMethod[]
  onContinueSameCategory: () => void
  onFinish: () => void
  onOpenEdit: () => void
}

export default function SavedCompletionModal({
  isOpen,
  onClose,
  transaction,
  categories,
  subcategories,
  paymentMethods,
  onContinueSameCategory,
  onFinish,
  onOpenEdit,
}: SavedCompletionModalProps) {
  if (!isOpen || !transaction) return null

  const category = categories.find((c) => c.id === transaction.category_id)
  const subcategory = subcategories.find((s) => s.id === transaction.subcategory_id)
  const paymentMethod = paymentMethods.find((p) => p.id === transaction.payment_method_id)

  const isExpense = transaction.type === 'expense'
  const typeLabel = isExpense ? '支出' : '収入'
  const amountColor = isExpense ? '#f87171' : '#34d399'

  // 日付のフォーマット (YYYY-MM-DD -> YYYY年M月D日)
  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-')
      if (y && m && d) {
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
        const dayNames = ['日', '月', '火', '水', '木', '金', '土']
        const dayOfWeek = dayNames[dateObj.getDay()]
        return `${parseInt(m, 10)}月${parseInt(d, 10)}日 (${dayOfWeek})`
      }
    } catch {
      // fallback
    }
    return dateStr
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'linear-gradient(180deg, #1e1e32 0%, #131320 100%)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderBottom: 'none',
          padding: '24px 20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              入力完了
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: isExpense ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: amountColor,
                fontWeight: 600,
              }}
            >
              {typeLabel}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* 保存内容カード */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 金額表示 */}
          <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>保存した金額</div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 34,
                fontWeight: 800,
                color: amountColor,
                letterSpacing: '-0.5px',
              }}
            >
              ¥{transaction.amount.toLocaleString()}
            </div>
          </div>

          {/* 明細詳細リスト */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: 12,
              fontSize: 13,
            }}
          >
            {/* 日付 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>日付</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                📅 {formatDate(transaction.date)}
              </span>
            </div>

            {/* カテゴリ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>カテゴリ</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {category ? (
                  <>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: `${category.color || '#8b5cf6'}22`,
                        color: category.color || '#8b5cf6',
                        fontWeight: 600,
                        fontSize: 12,
                        border: `1px solid ${category.color || '#8b5cf6'}44`,
                      }}
                    >
                      {category.icon || '🏷️'} {category.name}
                    </span>
                    {subcategory && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        › {subcategory.name}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>未分類</span>
                )}
              </div>
            </div>

            {/* 支払い方法 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>支払い方法</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {paymentMethod ? `${paymentMethod.icon || '💳'} ${paymentMethod.name}` : '未指定'}
              </span>
            </div>

            {/* メモ */}
            {transaction.memo && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>メモ</span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    wordBreak: 'break-word',
                  }}
                >
                  {transaction.memo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* アクションボタングループ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {/* 1. メイン: 続けて入力（カテゴリ維持） */}
          <button
            onClick={onContinueSameCategory}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: '#ffffff',
              fontFamily: 'var(--font-heading)',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 18px rgba(139, 92, 246, 0.4)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>🔄</span>
            <span>続けて入力（カテゴリ維持）</span>
          </button>

          {/* 2. サブアクション: 修正 & 完了 */}
          <div style={{ display: 'flex', gap: 10 }}>
            {/* 修正ボタン */}
            <button
              onClick={onOpenEdit}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-purple)',
                fontFamily: 'var(--font-heading)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.15s ease',
              }}
            >
              <span>✏️</span>
              <span>修正する</span>
            </button>

            {/* 完了ボタン */}
            <button
              onClick={onFinish}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.15s ease',
              }}
            >
              <span>✅</span>
              <span>完了</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
