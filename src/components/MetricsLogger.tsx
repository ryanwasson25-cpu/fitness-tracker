import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BodyMetric } from '../types/database'
import styles from './MetricsLogger.module.css'

interface Props {
  userId: string
  onSaved: () => void
  onCancel: () => void
  editMetric?: BodyMetric
}

interface FormState {
  date: string
  weight_lbs: string
  body_fat_pct: string
  sleep_score: number | null
  steps: string
  notes: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function parseNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function numToStr(val: number | null | undefined): string {
  return val != null ? String(val) : ''
}

function sleepLabel(score: number): string {
  if (score <= 20) return 'Terrible'
  if (score <= 40) return 'Poor'
  if (score <= 60) return 'Fair'
  if (score <= 80) return 'Good'
  return 'Excellent'
}

function sleepColor(score: number): string {
  if (score <= 20) return '#ff6b6b'
  if (score <= 40) return '#e07b39'
  if (score <= 60) return '#f5c842'
  if (score <= 80) return '#00d4aa'
  return '#00ff99'
}

export default function MetricsLogger({ userId, onSaved, onCancel, editMetric }: Props) {
  const isEditMode = !!editMetric

  const [form, setForm] = useState<FormState>({
    date: editMetric?.date ?? today(),
    weight_lbs: numToStr(editMetric?.weight_lbs),
    body_fat_pct: numToStr(editMetric?.body_fat_pct),
    sleep_score: editMetric?.sleep_score ?? null,
    steps: numToStr(editMetric?.steps),
    notes: editMetric?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    const hasData = form.weight_lbs || form.body_fat_pct || form.sleep_score != null || form.steps
    if (!hasData) {
      setError('Enter at least one value to save.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      date: form.date,
      weight_lbs: parseNum(form.weight_lbs),
      body_fat_pct: parseNum(form.body_fat_pct),
      sleep_score: form.sleep_score,
      steps: parseNum(form.steps),
      notes: form.notes.trim() || null,
    }

    let dbError = null

    if (isEditMode && editMetric) {
      const { error: e } = await supabase
        .from('body_metrics')
        .update(payload)
        .eq('id', editMetric.id)
      dbError = e
    } else {
      const { error: e } = await supabase.from('body_metrics').insert({
        user_id: userId,
        ...payload,
      })
      dbError = e
    }

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
        <h2 className={styles.heading}>{isEditMode ? 'Edit Body Stats' : 'Log Body Stats'}</h2>
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

        <div className={styles.row2}>
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
      </div>

      {/* Sleep Quality */}
      <div className={styles.section}>
        <div className={styles.field}>
          <label className={styles.sleepLabel}>
            Sleep Quality
            {form.sleep_score != null && (
              <span className={styles.sleepLabelScore} style={{ color: sleepColor(form.sleep_score) }}>
                {form.sleep_score}/100 · {sleepLabel(form.sleep_score)}
              </span>
            )}
          </label>
          <div className={styles.sleepSliderWrap}>
            <span className={styles.sleepSliderMin}>1</span>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={form.sleep_score ?? 50}
              className={styles.sleepSlider}
              style={form.sleep_score != null ? { accentColor: sleepColor(form.sleep_score) } : {}}
              onChange={e => set('sleep_score', parseInt(e.target.value, 10))}
              onMouseDown={() => { if (form.sleep_score == null) set('sleep_score', 50) }}
              onTouchStart={() => { if (form.sleep_score == null) set('sleep_score', 50) }}
            />
            <span className={styles.sleepSliderMax}>100</span>
            {form.sleep_score != null && (
              <button
                type="button"
                className={styles.sleepClearBtn}
                onClick={() => set('sleep_score', null)}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
          <p className={styles.sleepHint}>1 = terrible · 100 = excellent · drag to set</p>
        </div>

        <div className={styles.field}>
          <label>Daily Steps</label>
          <input
            type="number"
            min="0"
            step="100"
            placeholder="e.g. 8500"
            value={form.steps}
            onChange={e => set('steps', e.target.value)}
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
        {saving ? 'Saving…' : isEditMode ? 'Update Stats' : 'Save Stats'}
      </button>
    </div>
  )
}
