'use client'

import { useState } from 'react'
import type { Category, Subcategory } from '@/types'
import { createClient } from '@/lib/supabase'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  subcategories: Subcategory[]
  selectedCatId: string | null
  selectedSubId: string | null
  onSelect: (catId: string | null, subId: string | null) => void
  onRefresh: () => void
}

const DEFAULT_ICONS = ['🍽️', '🏠', '🎮', '🤝', '🔄', '📚', '💰', '🚗', '🛍️', '🏥', '✈️', '🐾', '📱', '⚡', '☕']
const DEFAULT_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#F59E0B', '#6366F1', '#10B981', '#F472B6', '#EC4899', '#3B82F6']

export default function CategoryModal({
  isOpen,
  onClose,
  categories,
  subcategories,
  selectedCatId,
  selectedSubId,
  onSelect,
  onRefresh,
}: CategoryModalProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'select' | 'manage'>('select')
  const [tempCatId, setTempCatId] = useState<string | null>(selectedCatId)
  
  // 管理・新規追加用フォーム
  const [isCreating, setIsCreating] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('🛍️')
  const [newCatColor, setNewCatColor] = useState('#4ECDC4')
  
  const [newSubName, setNewSubName] = useState('')
  const [addingSubCatId, setAddingSubCatId] = useState<string | null>(null)

  if (!isOpen) return null

  // 現在選択中または展開中の大カテゴリ
  const currentCat = categories.find((c) => c.id === tempCatId)
  const currentSubs = subcategories.filter((s) => s.category_id === tempCatId)

  // カテゴリ新規作成
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    try {
      await supabase.from('categories').insert({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        sort_order: categories.length + 1,
      })
      setNewCatName('')
      setIsCreating(false)
      onRefresh()
    } catch (err) {
      console.error('Category create error:', err)
    }
  }

  // カテゴリ削除
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`「${name}」カテゴリを削除しますか？`)) return
    try {
      await supabase.from('categories').delete().eq('id', id)
      if (tempCatId === id) setTempCatId(null)
      onRefresh()
    } catch (err) {
      console.error('Category delete error:', err)
    }
  }

  // サブカテゴリ新規作成
  const handleCreateSubcategory = async (catId: string) => {
    if (!newSubName.trim()) return
    try {
      await supabase.from('subcategories').insert({
        category_id: catId,
        name: newSubName.trim(),
        sort_order: subcategories.filter((s) => s.category_id === catId).length + 1,
      })
      setNewSubName('')
      setAddingSubCatId(null)
      onRefresh()
    } catch (err) {
      console.error('Subcategory create error:', err)
    }
  }

  // サブカテゴリ削除
  const handleDeleteSubcategory = async (id: string) => {
    try {
      await supabase.from('subcategories').delete().eq('id', id)
      onRefresh()
    } catch (err) {
      console.error('Subcategory delete error:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>
            {activeTab === 'select' ? 'カテゴリを選択' : 'カテゴリをカスタマイズ'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Step 1: 大カテゴリ一覧 */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                1. 大カテゴリ
              </div>
              <div className="category-grid">
                {categories.map((cat) => {
                  const isSelected = tempCatId === cat.id
                  return (
                    <button
                      key={cat.id}
                      className={`cat-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        borderColor: isSelected ? cat.color || 'var(--accent-pink)' : 'var(--border-subtle)',
                        background: isSelected ? `${cat.color || '#8B5CF6'}25` : 'var(--bg-glass)',
                      }}
                      onClick={() => setTempCatId(cat.id)}
                    >
                      <span style={{ fontSize: 24 }}>{cat.icon || '📁'}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: 中カテゴリ（選択された大カテゴリがある場合） */}
            {tempCatId && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                  2. 「{currentCat?.name}」の詳細タグ (任意)
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <button
                    className={`chip ${selectedCatId === tempCatId && selectedSubId === null ? 'selected' : ''}`}
                    onClick={() => {
                      onSelect(tempCatId, null)
                      onClose()
                    }}
                  >
                    指定なし（{currentCat?.name} 全般）
                  </button>
                  {currentSubs.map((sub) => {
                    const isSelected = selectedCatId === tempCatId && selectedSubId === sub.id
                    return (
                      <button
                        key={sub.id}
                        className={`chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          onSelect(tempCatId, sub.id)
                          onClose()
                        }}
                      >
                        {sub.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MANAGE MODE (編集・追加・削除) ── */}
        {activeTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
            {/* 新規作成ボタン・フォーム */}
            {!isCreating ? (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: 14 }}
                onClick={() => setIsCreating(true)}
              >
                ＋ 新しい大カテゴリを追加
              </button>
            ) : (
              <div style={{ background: 'var(--bg-glass)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>新しい大カテゴリ</div>
                <input
                  type="text"
                  placeholder="カテゴリ名（例: 交通費、ペット）"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
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
                          background: newCatIcon === icon ? 'var(--accent-pink)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => setNewCatIcon(icon)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn-primary" style={{ flex: 1, padding: 8 }} onClick={handleCreateCategory}>
                    作成
                  </button>
                  <button className="chip" style={{ padding: 8 }} onClick={() => setIsCreating(false)}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}

            {/* カテゴリ一覧 & 削除・中カテゴリ管理 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categories.map((cat) => {
                const subs = subcategories.filter((s) => s.category_id === cat.id)
                return (
                  <div
                    key={cat.id}
                    style={{
                      background: 'var(--bg-glass)',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{cat.icon || '📁'}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', color: '#FF6B6B', fontSize: 13, cursor: 'pointer' }}
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      >
                        削除
                      </button>
                    </div>

                    {/* 中カテゴリ一覧 */}
                    <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>中カテゴリ (タグ)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {subs.map((s) => (
                          <span
                            key={s.id}
                            style={{
                              background: 'var(--bg-dark)',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {s.name}
                            <button
                              style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
                              onClick={() => handleDeleteSubcategory(s.id)}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {addingSubCatId !== cat.id ? (
                          <button
                            style={{ background: 'none', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                            onClick={() => setAddingSubCatId(cat.id)}
                          >
                            ＋ 中カテゴリ追加
                          </button>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <input
                              type="text"
                              placeholder="新中カテゴリ"
                              value={newSubName}
                              onChange={(e) => setNewSubName(e.target.value)}
                              style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '2px 6px', fontSize: 12, color: 'white', width: 100 }}
                            />
                            <button className="btn-primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handleCreateSubcategory(cat.id)}>
                              追加
                            </button>
                            <button className="chip" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setAddingSubCatId(null)}>
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
