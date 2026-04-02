import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BodyMetric } from '../types/database'
import styles from './MetricsList.module.css'

interface Props {
  userId: string
  onStartLog: () => void
  onEdit: (entry: BodyMetric) => void
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function sleepEmoji(score: number): string {
  if (score <= 20) return '😴'
  if (score <= 40) return '😪'
  if (score <= 60) return '😐'
  if (score <= 80) return '😊'
  return '🌟'
}

function sleepColor(score: number): string {
  if (score <= 20) return '#ff6b6b'
  if (score <= 40) return '#e07b39'
  if (score <= 60) return '#f5c842'
  if (score <= 80) return '#00d4aa'
  return '#00ff99'
}

export default function MetricsList({ userId, onStartLog, onEdit }: Props) {
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
        <p className={styles.emptyText}>Track your weight, sleep, and steps over time.</p>
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
        const chips: { label: string; color?: string }[] = []
        if (entry.weight_lbs != null) chips.push({ label: `${entry.weight_lbs} lbs` })
        if (entry.body_fat_pct != null) chips.push({ label: `${entry.body_fat_pct}% BF`, color: '#e07b39' })
        if (entry.sleep_score != null) chips.push({
          label: `${sleepEmoji(entry.sleep_score)} ${entry.sleep_score}/100 sleep`,
          color: sleepColor(entry.sleep_score),
        })
        if (entry.steps != null) chips.push({ label: `👟 ${entry.steps.toLocaleString()} steps` })

        return (
          <div key={entry.id} className={styles.card}>
            <div className={styles.cardContent}>
              <div className={styles.cardInfo}>
                <span className={styles.cardDate}>{formatDate(entry.date)}</span>
                {chips.length > 0 ? (
                  <div className={styles.chipRow}>
                    {chips.map((chip, i) => (
                      <span
                        key={i}
                        className={styles.chip}
                        style={chip.color ? { color: chip.color } : undefined}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={styles.cardStats}>No data</span>
                )}
                {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.editBtn}
                  onClick={() => onEdit(entry)}
                >
                  Edit
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(entry.id)}
                  disabled={deleting === entry.id}
                >
                  {deleting === entry.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
