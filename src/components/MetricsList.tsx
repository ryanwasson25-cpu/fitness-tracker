import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BodyMetric } from '../types/database'
import styles from './MetricsList.module.css'

interface Props {
  userId: string
  onStartLog: () => void
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function MetricsList({ userId, onStartLog }: Props) {
  const [entries, setEntries] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: dbError } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      setLoading(false)
      if (dbError) {
        setError(dbError.message)
      } else {
        setEntries(data ?? [])
      }
    }
    load()
  }, [userId])

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    setDeleting(id)
    const { error: dbError } = await supabase
      .from('body_metrics')
      .delete()
      .eq('id', id)
    setDeleting(null)
    if (dbError) {
      setError(dbError.message)
    } else {
      setEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (error) return <p className={styles.error}>{error}</p>

  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No stats logged yet</p>
        <p className={styles.emptyText}>Track your weight and body fat over time.</p>
        <button className={styles.startBtn} onClick={onStartLog}>+ Log Stats</button>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <h2 className={styles.heading}>Body Stats</h2>
        <span className={styles.count}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {entries.map(entry => {
        const weightStr = entry.weight_lbs != null ? `${entry.weight_lbs} lbs` : null
        const bfStr = entry.body_fat_pct != null ? `${entry.body_fat_pct}% BF` : null
        const statLine = [weightStr, bfStr].filter(Boolean).join(' · ') || 'No data'

        return (
          <div key={entry.id} className={styles.card}>
            <div className={styles.cardContent}>
              <div className={styles.cardInfo}>
                <span className={styles.cardDate}>{formatDate(entry.date)}</span>
                <span className={styles.cardStats}>{statLine}</span>
                {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(entry.id)}
                disabled={deleting === entry.id}
              >
                {deleting === entry.id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
