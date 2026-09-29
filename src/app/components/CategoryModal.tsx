'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Category, Subcategory, TransactionType } from '@/types'
import { createClient } from '@/lib/supabase'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  subcategories: Subcategory[]
  selectedCatId: string | null
  selectedSubId: string | null
  txType: TransactionType
  onSelect: (catId: string | null, subId: string | null) => void
  onRefresh: () => void
}

const DEFAULT_ICONS = ['🍽️', '🧻', '🎮', '🤝', '🚃', '🚗', '💄', '🏥', '📚', '🛋️', '💳', '💡', '📱', '🏠', '🏛️', '🛡️', '📦', '💰', '🎁', '💼']
const DEFAULT_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#F59E0B', '#3B82F6', '#60A5FA', '#EC4899', '#10B981', '#6366F1', '#F97316', '#8B5CF6', '#EAB308', '#06B6D4', '#84CC16']

const INCOME_NAMES = ['給与', '一時所得', '事業・副業', '年金', '配当所得', '不動産所得', '不明な入金', 'その他入金']

// ── ソータブル行コンポーネント ──────────────────────────────────
interface SortableCatRowProps {
  cat: Category
  subs: Subcategory[]
  isIncomeMode: boolean
  addingSubCatId: string | null
  newSubName: string
  onSetAddingSubCatId: (id: string | null) => void
  onSetNewSubName: (v: string) => void
  onDeleteCategory: (id: string, name: string) => void
  onDeleteSubcategory: (id: string) => void
  onCreateSubcategory: (catId: string) => void
}

function SortableCatRow({
  cat,
  subs,
  isIncomeMode,
  addingSubCatId,
  newSubName,
  onSetAddingSubCatId,
  onSetNewSubName,
  onDeleteCategory,
  onDeleteSubcategory,
  onCreateSubcategory,
}: SortableCatRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-glass)',
    border: `1px solid ${isDragging ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
    padding: 12,
    borderRadius: 12,
    touchAction: 'none',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          {/* ドラッグハンドル */}
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '4px 6px',
              color: 'var(--text-muted)',
              fontSize: 16,
              userSelect: 'none',
              touchAction: 'none',
            }}
            title="長押し／ドラッグで並び替え"
          >
            ⠿
          </div>
          <span style={{ fontSize: 20 }}>{cat.icon || '📁'}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
        </div>
        <button
          style={{ background: 'none', border: 'none', color: '#FF6B6B', fontSize: 13, cursor: 'pointer' }}
          onClick={() => onDeleteCategory(cat.id, cat.name)}
        >
          削除
        </button>
      </div>

      {/* 中カテゴリ管理 (支出モードのみ) */}
      {!isIncomeMode && (
        <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>中カテゴリ (詳細項目)</div>
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
                  onClick={() => onDeleteSubcategory(s.id)}
                >
                  ✕
                </button>
              </span>
            ))}
            {addingSubCatId !== cat.id ? (
              <button
                style={{ background: 'none', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                onClick={() => onSetAddingSubCatId(cat.id)}
              >
                ＋ 中カテゴリ追加
              </button>
            ) : (
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <input
                  type="text"
                  placeholder="項目名"
                  value={newSubName}
                  onChange={(e) => onSetNewSubName(e.target.value)}
                  style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '2px 6px', fontSize: 12, color: 'white', width: 100 }}
                />
                <button className="btn-primary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onCreateSubcategory(cat.id)}>
                  追加
                </button>
                <button className="chip" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => onSetAddingSubCatId(null)}>
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── メインコンポーネント ───────────────────────────────────────────
export default function CategoryModal({
  isOpen,
  onClose,
  categories,
  subcategories,
  selectedCatId,
  selectedSubId,
  txType,
  onSelect,
  onRefresh,
}: CategoryModalProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'select' | 'manage'>('select')
  const [tempCatId, setTempCatId] = useState<string | null>(selectedCatId)

  const [isCreating, setIsCreating] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [newCatColor, setNewCatColor] = useState('#8B5CF6')

  const [newSubName, setNewSubName] = useState('')
  const [addingSubCatId, setAddingSubCatId] = useState<string | null>(null)

  // dnd-kit sensors: マウス＋タッチ（長押し250msでアクティブ化）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  if (!isOpen) return null

  const isIncomeMode = txType === 'income'
  const filteredCategories = categories.filter((cat) => {
    const isInc = cat.type === 'income' || INCOME_NAMES.includes(cat.name)
    return isIncomeMode ? isInc : !isInc
  })

  // ── ハンドラ ────────────────────────────────────────────────────
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    try {
      await supabase.from('categories').insert({
        name: newCatName.trim(),
        type: isIncomeMode ? 'income' : 'expense',
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

  const handleDeleteSubcategory = async (id: string) => {
    try {
      await supabase.from('subcategories').delete().eq('id', id)
      onRefresh()
    } catch (err) {
      console.error('Subcategory delete error:', err)
    }
  }

  // ドラッグ終了時: sort_order を一括更新
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = filteredCategories.findIndex((c) => c.id === active.id)
    const newIdx = filteredCategories.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(filteredCategories, oldIdx, newIdx)

    try {
      await Promise.all(
        reordered.map((cat, idx) =>
          supabase.from('categories').update({ sort_order: idx + 1 }).eq('id', cat.id)
        )
      )
      onRefresh()
    } catch (err) {
      console.error('Category reorder error:', err)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card-glass" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>
            {activeTab === 'select'
              ? isIncomeMode
                ? '収入カテゴリを選択'
                : '支出カテゴリを選択'
              : 'カテゴリをカスタマイズ'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              {isIncomeMode ? '収入カテゴリをタップして選択' : '大カテゴリをタップすると真下に詳細カテゴリが開きます'}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxHeight: '60vh',
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {filteredCategories.map((cat) => {
                const isExpanded = tempCatId === cat.id
                const catSubs = subcategories.filter((s) => s.category_id === cat.id)

                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: isExpanded ? `${cat.color || '#8B5CF6'}25` : 'var(--bg-glass)',
                        border: `1.5px solid ${isExpanded ? cat.color || 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        color: 'white',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        if (isIncomeMode) {
                          onSelect(cat.id, null)
                          onClose()
                        } else {
                          setTempCatId(isExpanded ? null : cat.id)
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{cat.icon || '📁'}</span>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{cat.name}</div>
                          {!isIncomeMode && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {catSubs.length > 0 ? `${catSubs.length}件の詳細項目` : '詳細項目なし'}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isIncomeMode && (
                        <span
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          ▼
                        </span>
                      )}
                    </button>

                    {!isIncomeMode && isExpanded && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: `1px dashed ${cat.color || 'var(--accent-purple)'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: 12,
                          marginLeft: 12,
                          marginRight: 4,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ fontSize: 11, color: 'var(--accent-pink)', fontWeight: 600 }}>
                          「{cat.name}」の詳細カテゴリを選択してください:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            className={`chip ${selectedCatId === cat.id && selectedSubId === null ? 'selected' : ''}`}
                            style={{
                              fontSize: 12,
                              padding: '6px 14px',
                              fontWeight: selectedCatId === cat.id && selectedSubId === null ? 700 : 500,
                            }}
                            onClick={() => {
                              onSelect(cat.id, null)
                              onClose()
                            }}
                          >
                            指定なし（{cat.name} 全般）
                          </button>

                          {catSubs.map((sub) => {
                            const isSelected = selectedCatId === cat.id && selectedSubId === sub.id
                            return (
                              <button
                                key={sub.id}
                                className={`chip ${isSelected ? 'selected' : ''}`}
                                style={{
                                  fontSize: 12,
                                  padding: '6px 14px',
                                  background: isSelected ? 'rgba(236, 72, 153, 0.3)' : 'var(--bg-glass)',
                                  borderColor: isSelected ? 'var(--accent-pink)' : 'var(--border-subtle)',
                                  color: isSelected ? 'white' : 'var(--text-primary)',
                                  fontWeight: isSelected ? 700 : 500,
                                }}
                                onClick={() => {
                                  onSelect(cat.id, sub.id)
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
                )
              })}
            </div>
          </div>
        )}

        {/* ── MANAGE MODE ── */}
        {activeTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
            {!isCreating ? (
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: 14 }}
                onClick={() => setIsCreating(true)}
              >
                ＋ 新しい大カテゴリを追加 ({isIncomeMode ? '収入' : '支出'})
              </button>
            ) : (
              <div style={{ background: 'var(--bg-glass)', padding: 12, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>新しい大カテゴリ ({isIncomeMode ? '収入' : '支出'})</div>
                <input
                  type="text"
                  placeholder="カテゴリ名"
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

            {/* ドラッグ可能なカテゴリ一覧 */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              ⠿ をドラッグ（長押し）して並び替えできます
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredCategories.map((cat) => (
                    <SortableCatRow
                      key={cat.id}
                      cat={cat}
                      subs={subcategories.filter((s) => s.category_id === cat.id)}
                      isIncomeMode={isIncomeMode}
                      addingSubCatId={addingSubCatId}
                      newSubName={newSubName}
                      onSetAddingSubCatId={setAddingSubCatId}
                      onSetNewSubName={setNewSubName}
                      onDeleteCategory={handleDeleteCategory}
                      onDeleteSubcategory={handleDeleteSubcategory}
                      onCreateSubcategory={handleCreateSubcategory}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  )
}
