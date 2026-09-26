'use client'

import { Category } from '@/types'

interface CategoryTotal {
  category: Category
  total: number
  percentage: number
}

interface DonutChartProps {
  data: CategoryTotal[]
  totalExpense: number
}

export default function DonutChart({ data, totalExpense }: DonutChartProps) {
  if (totalExpense <= 0 || data.length === 0) {
    return (
      <div
        style={{
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        今月の支出データがありません
      </div>
    )
  }

  // SVG 円グラフ計算 (Stroke DashArray)
  let cumulativeAngle = 0
  const radius = 60
  const circumference = 2 * Math.PI * radius

  const slices = data.map((item) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`
    const strokeDashoffset = -((cumulativeAngle / 100) * circumference)
    cumulativeAngle += item.percentage
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      color: item.category?.color || '#8B5CF6',
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* SVG ドーナツグラフ */}
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="20" />
          {slices.map((slice, i) => (
            <circle
              key={slice.category?.id || i}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="22"
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              style={{ transition: 'all 0.5s ease' }}
            />
          ))}
        </svg>
        {/* 中央の合計数値 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>支出合計</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'white', fontFamily: 'var(--font-heading)' }}>
            ¥{totalExpense.toLocaleString('ja-JP')}
          </div>
        </div>
      </div>

      {/* 凡例（カラーコードと比率） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', width: '100%' }}>
        {data.map((item) => (
          <div key={item.category?.id || item.category?.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: item.category?.color || '#8B5CF6',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.category?.icon} {item.category?.name}
              </span>
            </div>
            <span style={{ fontWeight: 700, color: 'white', marginLeft: 4 }}>{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
