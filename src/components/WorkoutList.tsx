import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Workout, WorkoutSet } from '../types/database'
import styles from './WorkoutList.module.css'

interface Props {
  userId: string
  onStartLog: () => void
}

interface WorkoutWithSets extends Workout {
  sets: WorkoutSet[]
  expanded: boolean
}

export default function WorkoutList({ userId, onStartLog }: Props) {
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(50)

      if (error) {
        setError(error.message)
      } else {
        setWorkouts((data ?? []).map(w => ({ ...w, sets: [], expanded: false })))
      }
      setLoading(false)
    }

    load()
  }, [userId])

  async function toggleWorkout(id: string) {
    setWorkouts(prev => prev.map(w => {
      if (w.id !== id) return w
      return { ...w, expanded: !w.expanded }
    }))

    const workout = workouts.find(w => w.id === id)
    if (!workout || workout.sets.length > 0) return

    const { data } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_id', id)
      .order('set_number', { ascending: true })

    if (data) {
      setWorkouts(prev => prev.map(w =>
        w.id === id ? { ...w, sets: data } : w
      ))
    }
  }

  async function deleteWorkout(id: string) {
    if (!confirm('Delete this workout?')) return
    await supabase.from('sets').delete().eq('workout_id', id)
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function groupSetsByExercise(sets: WorkoutSet[]) {
    const groups: Record<string, WorkoutSet[]> = {}
    for (const set of sets) {
      if (!groups[set.exercise_name]) groups[set.exercise_name] = []
      groups[set.exercise_name].push(set)
    }
    return groups
  }

  if (loading) return <p className={styles.empty}>Loading workouts…</p>
  if (error) return <p className={styles.error}>Error: {error}</p>

  if (workouts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>No workouts yet</p>
        <p className={styles.emptyText}>Log your first workout to get started.</p>
        <button className={styles.startBtn} onClick={onStartLog}>+ Log Workout</button>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <h2 className={styles.heading}>Workout History</h2>
        <span className={styles.count}>{workouts.length} workouts</span>
      </div>

      {workouts.map(workout => (
        <div key={workout.id} className={styles.card}>
          <button className={styles.cardHeader} onClick={() => toggleWorkout(workout.id)}>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>{workout.name}</span>
              <span className={styles.cardDate}>{formatDate(workout.date)}</span>
            </div>
            <span className={styles.chevron}>{workout.expanded ? '▲' : '▼'}</span>
          </button>

          {workout.notes && !workout.expanded && (
            <p className={styles.cardNotes}>{workout.notes}</p>
          )}

          {workout.expanded && (
            <div className={styles.cardBody}>
              {workout.notes && <p className={styles.notes}>{workout.notes}</p>}

              {workout.sets.length === 0 ? (
                <p className={styles.noSets}>No sets recorded.</p>
              ) : (
                Object.entries(groupSetsByExercise(workout.sets)).map(([name, sets]) => (
                  <div key={name} className={styles.exerciseGroup}>
                    <h4 className={styles.exerciseName}>{name}</h4>
                    <table className={styles.setsTable}>
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Reps</th>
                          <th>Weight (lbs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sets.map(set => (
                          <tr key={set.id}>
                            <td>{set.set_number}</td>
                            <td>{set.reps ?? '—'}</td>
                            <td>{set.weight_lbs ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}

              <button className={styles.deleteBtn} onClick={() => deleteWorkout(workout.id)}>
                Delete workout
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
