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
  chest_in: string
  waist_in: string
  hips_in: string
  arms_in: string
  legs_in: string
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
    chest_in: '',
    waist_in: '',
    hips_in: '',
    arms_in: '',
    legs_in: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    const hasAnyValue =
      form.weight_lbs || form.chest_in || form.waist_in ||
      form.hips_in || form.arms_in || form.legs_in
    if (!hasAnyValue) {
      setError('Enter at least one measurement to save.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: dbError } = await supabase.from('body_metrics').insert({
      user_id: userId,
      date: form.date,
      weight_lbs: parseNum(form.weight_lbs),
      chest_in: parseNum(form.chest_in),
      waist_in: parseNum(form.waist_in),
      hips_in: parseNum(form.hips_in),
      arms_in: parseNum(form.arms_in),
      legs_in: parseNum(form.legs_in),
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
        <h2 className={styles.heading}>Log Body Metrics</h2>
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
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Measurements (inches)</p>
        <div className={styles.grid}>
          {([
            ['chest_in', 'Chest'],
            ['waist_in', 'Waist'],
            ['hips_in', 'Hips'],
            ['arms_in', 'Arms'],
            ['legs_in', 'Legs'],
          ] as [keyof FormState, string][]).map(([key, label]) => (
            <div key={key} className={styles.field}>
              <label>{label}</label>
              <input
                type="number"
                min="0"
                step="0.25"
                placeholder="0.00"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
              />
            </div>
          ))}
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
        {saving ? 'Saving…' : 'Save Metrics'}
      </button>
    </div>
  )
}
