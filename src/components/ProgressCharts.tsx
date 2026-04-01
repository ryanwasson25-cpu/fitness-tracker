import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { BodyMetric, Workout, WorkoutSet } from '../types/database'
import styles from './ProgressCharts.module.css'

interface Props {
  userId: string
}

interface VolumePoint {
  date: string
  volume: number
  name: string
}

interface ExercisePoint {
  date: string
  maxWeight: number
}

const ACCENT = '#00d4aa'
const BF_COLOR = '#e07b39'

function formatDate(dateStr: unknown) {
  if (typeof dateStr !== 'string') return String(dateStr ?? '')
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ProgressCharts({ userId }: Props) {
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([])
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [exerciseData, setExerciseData] = useState<ExercisePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [metricsRes, workoutsRes, exercisesRes] = await Promise.all([
        supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true }),
        supabase
          .from('workouts')
          .select('id, date, name, sets(reps, weight_lbs)')
          .eq('user_id', userId)
          .order('date', { ascending: true }),
        supabase
          .from('exercises')
          .select('id, name')
          .eq('user_id', userId)
          .order('name', { ascending: true }),
      ])

      if (metricsRes.data) {
        setBodyMetrics(metricsRes.data as BodyMetric[])
      }

      if (workoutsRes.data) {
        const points: VolumePoint[] = (workoutsRes.data as (Workout & { sets: Pick<WorkoutSet, 'reps' | 'weight_lbs'>[] })[])
          .map(w => {
            const volume = (w.sets ?? []).reduce((sum, s) => {
              return sum + (s.reps ?? 0) * (s.weight_lbs ?? 0)
            }, 0)
            return { date: w.date, volume: Math.round(volume), name: w.name }
          })
          .filter(p => p.volume > 0)
        setVolumeData(points)
      }

      if (exercisesRes.data) {
        setExercises(exercisesRes.data)
        if (exercisesRes.data.length > 0) {
          setSelectedExercise(exercisesRes.data[0].name)
        }
      }

      setLoading(false)
    }

    load()
  }, [userId])

  useEffect(() => {
    if (!selectedExercise) return

    async function loadExercise() {
      // RLS ensures we only see sets from our own workouts
      const { data } = await supabase
        .from('sets')
        .select('weight_lbs, workout_id, workouts!inner(date)')
        .eq('exercise_name', selectedExercise)
        .not('weight_lbs', 'is', null)

      if (!data) return

      // Group by workout date, get max weight
      const byWorkout = new Map<string, number>()
      for (const row of data as unknown as { weight_lbs: number; workouts: { date: string } }[]) {
        const date = row.workouts?.date
        if (!date) continue
        const prev = byWorkout.get(date) ?? 0
        if (row.weight_lbs > prev) {
          byWorkout.set(date, row.weight_lbs)
        }
      }

      const points: ExercisePoint[] = Array.from(byWorkout.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, maxWeight]) => ({ date, maxWeight }))

      setExerciseData(points)
    }

    loadExercise()
  }, [selectedExercise])

  const weightData = bodyMetrics
    .filter(m => m.weight_lbs != null)
    .map(m => ({ date: m.date, weight: m.weight_lbs }))

  const bodyFatData = bodyMetrics
    .filter(m => m.body_fat_pct != null)
    .map(m => ({ date: m.date, bodyFat: m.body_fat_pct }))

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>Progress</h2>
        <div className={styles.loading}>Loading charts…</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Progress</h2>

      {/* Body Weight */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Body Weight (lbs)</div>
        {weightData.length === 0 ? (
          <div className={styles.empty}>No data yet</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v} lbs`, 'Weight']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={{ r: 3, fill: ACCENT }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Body Fat % */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Body Fat %</div>
        {bodyFatData.length === 0 ? (
          <div className={styles.empty}>No data yet</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={bodyFatData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v}%`, 'Body Fat']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Line
                  type="monotone"
                  dataKey="bodyFat"
                  stroke={BF_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: BF_COLOR }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Workout Volume */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Workout Volume (lbs × reps)</div>
        {volumeData.length === 0 ? (
          <div className={styles.empty}>No data yet</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={volumeData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, props: any) => [
                    `${Number(v).toLocaleString()} lbs`,
                    props?.payload?.name ?? '',
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Bar dataKey="volume" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Exercise Progress */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Exercise Progress</div>
        {exercises.length === 0 ? (
          <div className={styles.empty}>No exercises logged yet</div>
        ) : (
          <>
            <div className={styles.exerciseRow}>
              <label>Exercise</label>
              <select
                className={styles.exerciseSelect}
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
              >
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.name}>{ex.name}</option>
                ))}
              </select>
            </div>
            {exerciseData.length === 0 ? (
              <div className={styles.empty}>No weight data for this exercise</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={exerciseData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      labelFormatter={formatDate}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [`${v} lbs`, 'Max Weight']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke={ACCENT}
                      strokeWidth={2}
                      dot={{ r: 3, fill: ACCENT }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
