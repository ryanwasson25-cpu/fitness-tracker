import { useEffect, useState, useMemo } from 'react'
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
  ReferenceLine,
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
const PR_COLOR = '#ffd700'
const SLEEP_COLOR = '#a78bfa'
const STEPS_COLOR = '#38bdf8'

type DateRange = '30d' | '90d' | '180d' | 'all'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '180d', label: '6m' },
  { value: 'all', label: 'All' },
]

function formatDate(dateStr: unknown) {
  if (typeof dateStr !== 'string') return String(dateStr ?? '')
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function cutoffDate(range: DateRange): string | null {
  if (range === 'all') return null
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 180
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function filterByRange<T extends { date: string }>(items: T[], range: DateRange): T[] {
  const cutoff = cutoffDate(range)
  if (!cutoff) return items
  return items.filter(item => item.date >= cutoff)
}

export default function ProgressCharts({ userId }: Props) {
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([])
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([])
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [exerciseData, setExerciseData] = useState<ExercisePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('90d')

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
      const { data } = await supabase
        .from('sets')
        .select('weight_lbs, workout_id, workouts!inner(date)')
        .eq('exercise_name', selectedExercise)
        .not('weight_lbs', 'is', null)

      if (!data) return

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

  // Apply date range filter
  const filteredWeightData = useMemo(() =>
    filterByRange(bodyMetrics.filter(m => m.weight_lbs != null), dateRange)
      .map(m => ({ date: m.date, weight: m.weight_lbs })),
    [bodyMetrics, dateRange]
  )

  const filteredBodyFatData = useMemo(() =>
    filterByRange(bodyMetrics.filter(m => m.body_fat_pct != null), dateRange)
      .map(m => ({ date: m.date, bodyFat: m.body_fat_pct })),
    [bodyMetrics, dateRange]
  )

  const filteredVolumeData = useMemo(() =>
    filterByRange(volumeData, dateRange),
    [volumeData, dateRange]
  )

  const filteredExerciseData = useMemo(() =>
    filterByRange(exerciseData, dateRange),
    [exerciseData, dateRange]
  )

  const filteredSleepData = useMemo(() =>
    filterByRange(bodyMetrics.filter(m => m.sleep_score != null), dateRange)
      .map(m => ({ date: m.date, sleep: m.sleep_score })),
    [bodyMetrics, dateRange]
  )

  const filteredStepsData = useMemo(() =>
    filterByRange(bodyMetrics.filter(m => m.steps != null), dateRange)
      .map(m => ({ date: m.date, steps: m.steps })),
    [bodyMetrics, dateRange]
  )

  // Personal records
  const allTimeMaxWeight = useMemo(() =>
    exerciseData.length > 0 ? Math.max(...exerciseData.map(p => p.maxWeight)) : null,
    [exerciseData]
  )
  const allTimeMaxWeightDate = useMemo(() => {
    if (!allTimeMaxWeight) return null
    return exerciseData.find(p => p.maxWeight === allTimeMaxWeight)?.date ?? null
  }, [exerciseData, allTimeMaxWeight])

  const rangeMaxWeight = useMemo(() =>
    filteredExerciseData.length > 0 ? Math.max(...filteredExerciseData.map(p => p.maxWeight)) : null,
    [filteredExerciseData]
  )

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>Progress</h2>
        <div className={styles.loading}>Loading charts…</div>
      </div>
    )
  }

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <h2 className={styles.heading}>Progress</h2>
        <div className={styles.rangeButtons}>
          {DATE_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.rangeBtn} ${dateRange === opt.value ? styles.rangeBtnActive : ''}`}
              onClick={() => setDateRange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body Weight */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Body Weight (lbs)</div>
        {filteredWeightData.length === 0 ? (
          <div className={styles.empty}>No data for this range</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredWeightData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                  contentStyle={tooltipStyle}
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
        {filteredBodyFatData.length === 0 ? (
          <div className={styles.empty}>No data for this range</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredBodyFatData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                  contentStyle={tooltipStyle}
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
        {filteredVolumeData.length === 0 ? (
          <div className={styles.empty}>No data for this range</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredVolumeData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="volume" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Sleep Quality */}
      {(filteredSleepData.length > 0 || bodyMetrics.some(m => m.sleep_score != null)) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Sleep Quality (1–10)</div>
          {filteredSleepData.length === 0 ? (
            <div className={styles.empty}>No data for this range</div>
          ) : (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filteredSleepData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                  />
                  <Tooltip
                    labelFormatter={formatDate}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`${v}/100`, 'Sleep Quality']}
                    contentStyle={tooltipStyle}
                  />
                  <ReferenceLine y={70} stroke="var(--border)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="sleep"
                    stroke={SLEEP_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SLEEP_COLOR }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Daily Steps */}
      {(filteredStepsData.length > 0 || bodyMetrics.some(m => m.steps != null)) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Daily Steps</div>
          {filteredStepsData.length === 0 ? (
            <div className={styles.empty}>No data for this range</div>
          ) : (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filteredStepsData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
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
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip
                    labelFormatter={formatDate}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [Number(v).toLocaleString(), 'Steps']}
                    contentStyle={tooltipStyle}
                  />
                  <ReferenceLine y={10000} stroke={STEPS_COLOR} strokeDasharray="4 4" strokeWidth={1}
                    label={{ value: '10k goal', fill: STEPS_COLOR, fontSize: 10, position: 'insideTopRight' }}
                  />
                  <Bar dataKey="steps" fill={STEPS_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

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

            {/* PR banner */}
            {allTimeMaxWeight != null && (
              <div className={styles.prBanner}>
                <span className={styles.prLabel}>🏆 All-time PR</span>
                <span className={styles.prValue}>{allTimeMaxWeight} lbs</span>
                {allTimeMaxWeightDate && (
                  <span className={styles.prDate}>{formatDate(allTimeMaxWeightDate)}</span>
                )}
              </div>
            )}

            {filteredExerciseData.length === 0 ? (
              <div className={styles.empty}>No weight data for this range</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredExerciseData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                      contentStyle={tooltipStyle}
                    />
                    {rangeMaxWeight != null && (
                      <ReferenceLine
                        y={rangeMaxWeight}
                        stroke={PR_COLOR}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'PR', fill: PR_COLOR, fontSize: 10, position: 'insideTopRight' }}
                      />
                    )}
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
