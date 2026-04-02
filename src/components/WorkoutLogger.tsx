import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WorkoutSetInsert } from '../types/database'
import styles from './WorkoutLogger.module.css'

export interface SetDraft {
  id: string
  exercise_name: string
  set_number: number
  reps: string
  weight_lbs: string
}

export interface WorkoutTemplate {
  name: string
  initialSets: SetDraft[]
}

export interface EditWorkoutData {
  workoutId: string
  name: string
  date: string
  notes: string
  sets: SetDraft[]
}

interface Props {
  userId: string
  onSaved: () => void
  onCancel: () => void
  template?: WorkoutTemplate
  editWorkout?: EditWorkoutData
}

function newSet(exerciseName: string, setNumber: number): SetDraft {
  return {
    id: crypto.randomUUID(),
    exercise_name: exerciseName,
    set_number: setNumber,
    reps: '',
    weight_lbs: '',
  }
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function WorkoutLogger({ userId, onSaved, onCancel, template, editWorkout }: Props) {
  const isEditMode = !!editWorkout

  const [name, setName] = useState(editWorkout?.name ?? template?.name ?? '')
  const [date, setDate] = useState(editWorkout?.date ?? today())
  const [notes, setNotes] = useState(editWorkout?.notes ?? '')
  const [sets, setSets] = useState<SetDraft[]>(
    editWorkout?.sets.map(s => ({ ...s, id: crypto.randomUUID() })) ??
    template?.initialSets.map(s => ({ ...s, id: crypto.randomUUID() })) ??
    []
  )
  const [currentExercise, setCurrentExercise] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete state
  const [allExerciseNames, setAllExerciseNames] = useState<string[]>([])
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Progressive overload suggestions (keyed by exercise name)
  interface OverloadHint {
    lastMax: number
    suggested: number
  }
  const [overloadHints, setOverloadHints] = useState<Record<string, OverloadHint>>({})

  useEffect(() => {
    supabase
      .from('exercises')
      .select('name')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        setAllExerciseNames((data ?? []).map((e: { name: string }) => e.name))
      })
  }, [userId])

  // Load progressive overload hints when using a template (repeat previous workout)
  useEffect(() => {
    if (!template || template.initialSets.length === 0) return

    const exerciseNames = [...new Set(template.initialSets.map(s => s.exercise_name))]

    async function loadHints() {
      const results: Record<string, OverloadHint> = {}

      await Promise.all(exerciseNames.map(async (exerciseName) => {
        const { data } = await supabase
          .from('sets')
          .select('weight_lbs, workouts!inner(date)')
          .ilike('exercise_name', exerciseName)
          .not('weight_lbs', 'is', null)

        if (!data || data.length === 0) return

        // Group by workout date, find max weight per session
        const byDate: Record<string, number> = {}
        for (const row of data as unknown as { weight_lbs: number; workouts: { date: string } }[]) {
          const date = row.workouts?.date
          if (!date) continue
          if (!byDate[date] || row.weight_lbs > byDate[date]) {
            byDate[date] = row.weight_lbs
          }
        }

        const sortedDates = Object.keys(byDate).sort().reverse()
        if (sortedDates.length < 2) return // Need at least 2 sessions to suggest

        const lastMax = byDate[sortedDates[0]]
        const prevMax = byDate[sortedDates[1]]

        // Only suggest if they held or improved their previous weight (ready to progress)
        if (lastMax >= prevMax) {
          const increment = lastMax >= 100 ? 5 : 2.5
          results[exerciseName] = { lastMax, suggested: lastMax + increment }
        }
      }))

      setOverloadHints(results)
    }

    loadHints()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.name])

  function handleExerciseInputChange(value: string) {
    setCurrentExercise(value)
    if (value.trim().length > 0) {
      const filtered = allExerciseNames.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredSuggestions(filtered.slice(0, 6))
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function selectSuggestion(name: string) {
    setCurrentExercise(name)
    setShowSuggestions(false)
  }

  function addExercise() {
    const trimmed = currentExercise.trim()
    if (!trimmed) return
    setSets(prev => [...prev, newSet(trimmed, 1)])
    setCurrentExercise('')
    setShowSuggestions(false)
  }

  function addSet(exerciseName: string) {
    const existingSets = sets.filter(s => s.exercise_name === exerciseName)
    setSets(prev => [...prev, newSet(exerciseName, existingSets.length + 1)])
  }

  function updateSet(id: string, field: 'reps' | 'weight_lbs', value: string) {
    setSets(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function removeSet(id: string) {
    setSets(prev => {
      const filtered = prev.filter(s => s.id !== id)
      const exerciseNames = [...new Set(filtered.map(s => s.exercise_name))]
      return exerciseNames.flatMap(name =>
        filtered
          .filter(s => s.exercise_name === name)
          .map((s, i) => ({ ...s, set_number: i + 1 }))
      )
    })
  }

  function removeExercise(exerciseName: string) {
    setSets(prev => prev.filter(s => s.exercise_name !== exerciseName))
  }

  // Group sets by exercise for display
  function groupedSets(): [string, SetDraft[]][] {
    const order: string[] = []
    const groups: Record<string, SetDraft[]> = {}
    for (const set of sets) {
      if (!groups[set.exercise_name]) {
        order.push(set.exercise_name)
        groups[set.exercise_name] = []
      }
      groups[set.exercise_name].push(set)
    }
    return order.map(name => [name, groups[name]])
  }

  async function saveSets(workoutId: string) {
    const setsToInsert: WorkoutSetInsert[] = []

    for (const set of sets) {
      let exerciseId: string

      const { data: existing } = await supabase
        .from('exercises')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', set.exercise_name)
        .maybeSingle()

      if (existing) {
        exerciseId = existing.id
      } else {
        const { data: created, error: exErr } = await supabase
          .from('exercises')
          .insert({ user_id: userId, name: set.exercise_name })
          .select('id')
          .single()

        if (exErr || !created) {
          setError(exErr?.message ?? 'Failed to create exercise.')
          setSaving(false)
          return false
        }
        exerciseId = created.id
      }

      setsToInsert.push({
        workout_id: workoutId,
        exercise_id: exerciseId,
        exercise_name: set.exercise_name,
        set_number: set.set_number,
        reps: set.reps ? parseInt(set.reps, 10) : null,
        weight_lbs: set.weight_lbs ? parseFloat(set.weight_lbs) : null,
      })
    }

    const { error: setsError } = await supabase.from('sets').insert(setsToInsert)
    if (setsError) {
      setError(setsError.message)
      setSaving(false)
      return false
    }
    return true
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Workout name is required.')
      return
    }
    if (sets.length === 0) {
      setError('Add at least one exercise set.')
      return
    }

    setError(null)
    setSaving(true)

    if (isEditMode && editWorkout) {
      // Edit mode: UPDATE workout record and replace sets
      const { error: updateError } = await supabase
        .from('workouts')
        .update({ name: name.trim(), date, notes: notes.trim() || null })
        .eq('id', editWorkout.workoutId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      // Delete existing sets and re-insert
      await supabase.from('sets').delete().eq('workout_id', editWorkout.workoutId)

      const ok = await saveSets(editWorkout.workoutId)
      if (!ok) return

      onSaved()
      return
    }

    // Create mode: INSERT new workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id: userId, name: name.trim(), date, notes: notes.trim() || null })
      .select()
      .single()

    if (workoutError || !workout) {
      setError(workoutError?.message ?? 'Failed to save workout.')
      setSaving(false)
      return
    }

    const ok = await saveSets(workout.id)
    if (!ok) return

    onSaved()
  }

  const groups = groupedSets()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{isEditMode ? 'Edit Workout' : 'Log Workout'}</h2>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>

      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="workout-name">Workout name</label>
            <input
              id="workout-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Push Day, Leg Day…"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="workout-date">Date</label>
            <input
              id="workout-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="workout-notes">Notes (optional)</label>
          <textarea
            id="workout-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it feel? Any PRs?"
            rows={2}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Exercises</h3>

        <div className={styles.addExercise}>
          <div className={styles.exerciseInputWrap}>
            <input
              type="text"
              value={currentExercise}
              onChange={e => handleExerciseInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addExercise()
                if (e.key === 'Escape') setShowSuggestions(false)
              }}
              onFocus={() => {
                if (currentExercise.trim() && filteredSuggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Exercise name (e.g. Bench Press)"
              autoComplete="off"
            />
            {showSuggestions && (
              <div className={styles.suggestions}>
                {filteredSuggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    className={styles.suggestion}
                    onMouseDown={() => selectSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.addBtn} onClick={addExercise}>Add</button>
        </div>

        {groups.length === 0 && (
          <p className={styles.noExercises}>No exercises added yet.</p>
        )}

        {groups.map(([exerciseName, exerciseSets]) => (
          <div key={exerciseName} className={styles.exerciseBlock}>
            <div className={styles.exerciseHeader}>
              <span className={styles.exerciseTitle}>{exerciseName}</span>
              <button
                className={styles.removeExerciseBtn}
                onClick={() => removeExercise(exerciseName)}
              >
                Remove
              </button>
            </div>

            {template && overloadHints[exerciseName] && (
              <div className={styles.overloadHint}>
                <span className={styles.overloadIcon}>💡</span>
                <span className={styles.overloadText}>
                  Last session: <strong>{overloadHints[exerciseName].lastMax} lbs</strong>
                  {' '}→ Try{' '}
                  <strong className={styles.overloadTarget}>{overloadHints[exerciseName].suggested} lbs</strong>
                  {' '}today
                </span>
              </div>
            )}

            <table className={styles.setsTable}>
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Reps</th>
                  <th>Weight (lbs)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exerciseSets.map(set => (
                  <tr key={set.id}>
                    <td className={styles.setNumber}>{set.set_number}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={set.reps}
                        onChange={e => updateSet(set.id, 'reps', e.target.value)}
                        placeholder="—"
                        className={styles.setInput}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={set.weight_lbs}
                        onChange={e => updateSet(set.id, 'weight_lbs', e.target.value)}
                        placeholder="—"
                        className={styles.setInput}
                      />
                    </td>
                    <td>
                      <button
                        className={styles.removeSetBtn}
                        onClick={() => removeSet(set.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className={styles.addSetBtn}
              onClick={() => addSet(exerciseName)}
            >
              + Add set
            </button>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : isEditMode ? 'Update Workout' : 'Save Workout'}
      </button>
    </div>
  )
}
