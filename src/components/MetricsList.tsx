import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BodyMetric } from '../types/database'
import styles from './MetricsList.module.css'

interface Props {
  userId: string
  onStartLog: () => void
}

const MEASUREMENT_FIELDS: { key: keyof BodyMetric; label: string }[] = [
  { key: 'chest_in', label: 'Chest' },
  { key: 'waist_in', label: 'Waist' },
  { key: 'hips_in', label: 'Hips' },
  { key: 'arms_in', label: 'Arms' },
  { key: 'legs_in', label: 'Legs' },
]

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
      if (expandedId === id) setExpandedId(null)
    }
  }

  if (loading) return <p className={styles.empty}>Loading…</p>
  if (error) return <p className={styles.error}>{error}</p>

  if (entries.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No metrics logged yet</p>
        <p className={styles.emptyText}>Track your body weight and measurements over time.</p>
        <button className={styles.startBtn} onClick={onStartLog}>+ Log Metrics</button>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <h2 className={styles.heading}>Body Metrics</h2>
        <span className={styles.count}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {entries.map(entry => {
        const isOpen = expandedId === entry.id
        const measurements = MEASUREMENT_FIELDS.filter(f => entry[f.key] != null)

        return (
          <div key={entry.id} className={styles.card}>
            <button
              className={styles.cardHeader}
              onClick={() => setExpandedId(isOpen ? null : entry.id)}
            >
              <div className={styles.cardInfo}>
                <span className={styles.cardDate}>{formatDate(entry.date)}</span>
                <span className={styles.cardWeight}>
                  {entry.weight_lbs != null ? `${entry.weight_lbs} lbs` : 'No weight'}
                  {measurements.length > 0 && (
                    <span className={styles.cardMeasurementCount}>
                      {' '}· {measurements.length} measurement{measurements.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </div>
              <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className={styles.cardBody}>
                {measurements.length > 0 && (
                  <div className={styles.measurementsGrid}>
                    {measurements.map(({ key, label }) => (
                      <div key={key} className={styles.measurement}>
                        <span className={styles.measureLabel}>{label}</span>
                        <span className={styles.measureValue}>{entry[key] as number}"</span>
                      </div>
                    ))}
                  </div>
                )}
                {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(entry.id)}
                  disabled={deleting === entry.id}
                >
                  {deleting === entry.id ? 'Deleting…' : 'Delete Entry'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
