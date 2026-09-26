'use client'

import { useState } from 'react'
import type { PaymentMethod } from '@/types'
import { createClient } from '@/lib/supabase'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  paymentMethods: PaymentMethod[]
  selectedPayId: string | null
  onSelect: (payId: string) => void
  onRefresh: () => void
}

const DEFAULT_ICONS = ['💵', '💳', '📱', '🏦', '🪙', '🎁', '🎫']

export default function PaymentModal({
  isOpen,
  onClose,
  paymentMethods,
  selectedPayId,
  onSelect,
  onRefresh,
}: PaymentModalProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'select' | 'manage'>('select')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('💳')

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await supabase.from('payment_methods').insert({
        name: newName.trim(),
        icon: newIcon,
        sort_order: paymentMethods.length + 1,
      })
      setNewName('')
      setIsCreating(false)
      onRefresh()
    } catch (err) {
      console.error('PaymentMethod create error:', err)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`支払い方法「${name}」を削除しますか？`)) return
    try {
      await supabase.from('payment_methods').delete().eq('id', id)
      onRefresh()
    } catch (err) {
      console.error('PaymentMethod delete error:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>
            {activeTab === 'select' ? '支払い方法を選択' : '支払い方法を管理'}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="chip"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setActiveTab(activeTab === 'select' ? 'manage' : 'select')}
            >
              {activeTab === 'select' ? '⚙️ 編集' : '戻る'}
            </button>
            <button className="chip" style={{ padding: '6px 10px', fontSize: 12 }} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* ── SELECT MODE ── */}
        {activeTab === 'select' && (
          <div className="category-grid">
            {paymentMethods.map((pm) => {
              const isSelected = selectedPayId === pm.id
              return (
                <button
                  key={pm.id}
                  className={`cat-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isSelected ? 'var(--accent-purple)' : 'var(--border-subtle)',
                    background: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-glass)',
                  }}
                  onClick={() => {
                    onSelect(pm.id)
                    onClose()
                  }}
                >
                  <span style={{ fontSize: 24 }}>{pm.icon || '💳'}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{pm.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── MANAGE MODE (編集・追加・削除) ── */}
        {activeTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
            {!isCreating ? (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: 14 }}
                onClick={() => setIsCreating(true)}
              >
                ＋ 新しい支払い方法を追加
              </button>
            ) : (
              <div style={{ background: 'var(--bg-glass)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>新しい支払い方法</div>
                <input
                  type="text"
                  placeholder="支払い方法名（例: 〇〇カード、Suica）"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-subtle)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'white',
                  }}
                />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>アイコンを選択</div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {DEFAULT_ICONS.map((icon) => (
                      <button
                        key={icon}
                        style={{
                          fontSize: 20,
                          padding: 6,
                          borderRadius: 6,
                          background: newIcon === icon ? 'var(--accent-purple)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => setNewIcon(icon)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn-primary" style={{ flex: 1, padding: 8 }} onClick={handleCreate}>
                    作成
                  </button>
                  <button className="chip" style={{ padding: 8 }} onClick={() => setIsCreating(false)}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* 一覧 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',

                    alignItems: 'center',
                    background: 'var(--bg-glass)',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{pm.icon || '💳'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{pm.name}</span>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: '#FF6B6B', fontSize: 13, cursor: 'pointer' }}
                    onClick={() => handleDelete(pm.id, pm.name)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
