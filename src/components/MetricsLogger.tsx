import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './MetricsLogger.module.css'

interface Props {
  userId: string
  onSaved: () => void
  onCancel: () => void
}

interface FormState {
  date: string
  weight_lbs: string
  body_fat_pct: string
  notes: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function parseNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

export default function MetricsLogger({ userId, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    date: today(),
    weight_lbs: '',
    body_fat_pct: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.weight_lbs && !form.body_fat_pct) {
      setError('Enter at least one value to save.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: dbError } = await supabase.from('body_metrics').insert({
      user_id: userId,
      date: form.date,
      weight_lbs: parseNum(form.weight_lbs),
      body_fat_pct: parseNum(form.body_fat_pct),
      notes: form.notes.trim() || null,
    })

    setSaving(false)
    if (dbError) {
      setError(dbError.message)
    } else {
      onSaved()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Log Body Stats</h2>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <label>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Body Weight (lbs)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 175.5"
            value={form.weight_lbs}
            onChange={e => set('weight_lbs', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Body Fat %</label>
          <input
            type="number"
            min="0"
            max="60"
            step="0.1"
            placeholder="e.g. 18.5"
            value={form.body_fat_pct}
            onChange={e => set('body_fat_pct', e.target.value)}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.field}>
          <label>Notes (optional)</label>
          <textarea
            rows={3}
            placeholder="Any notes..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save Stats'}
      </button>
    </div>
  )
}
