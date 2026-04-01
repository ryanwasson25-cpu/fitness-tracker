import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { View } from './Dashboard'
import styles from './HomeScreen.module.css'

interface Props {
  userId: string
  onNavigate: (view: View) => void
}

interface WeekSummary {
  workoutCount: number
  latestWeight: number | null
  latestBodyFat: number | null
}

interface RecentWorkout {
  id: string
  name: string
  date: string
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0 = Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

export default function HomeScreen({ userId, onNavigate }: Props) {
  const [summary, setSummary] = useState<WeekSummary>({
    workoutCount: 0,
    latestWeight: null,
    latestBodyFat: null,
  })
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { start, end } = getWeekBounds()

      const [workoutsThisWeekRes, recentWorkoutsRes, latestMetricRes] = await Promise.all([
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('workouts')
          .select('id, name, date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(3),
        supabase
          .from('body_metrics')
          .select('weight_lbs, body_fat_pct')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ])

      setSummary({
        workoutCount: workoutsThisWeekRes.count ?? 0,
        latestWeight: latestMetricRes.data?.weight_lbs ?? null,
        latestBodyFat: latestMetricRes.data?.body_fat_pct ?? null,
      })

      setRecentWorkouts((recentWorkoutsRes.data ?? []) as RecentWorkout[])
      setLoading(false)
    }

    load()
  }, [userId])

  if (loading) {
    return <div className={styles.container} />
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.greeting}>Welcome back!</h2>

      {/* This Week summary */}
      <div className={styles.summaryCard}>
        <p className={styles.summaryTitle}>This Week</p>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{summary.workoutCount}</span>
            <span className={styles.summaryLabel}>Workouts</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {summary.latestWeight != null ? `${summary.latestWeight}` : '—'}
            </span>
            <span className={styles.summaryLabel}>lbs</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {summary.latestBodyFat != null ? `${summary.latestBodyFat}%` : '—'}
            </span>
            <span className={styles.summaryLabel}>Body Fat</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Recent Activity</span>
          <button className={styles.sectionLink} onClick={() => onNavigate('history')}>
            View all
          </button>
        </div>
        <div className={styles.activityCard}>
          {recentWorkouts.length === 0 ? (
            <p className={styles.noActivity}>No workouts logged yet.</p>
          ) : (
            recentWorkouts.map(w => (
              <button
                key={w.id}
                className={styles.activityItem}
                onClick={() => onNavigate('history')}
              >
                <span className={styles.activityName}>{w.name}</span>
                <span className={styles.activityDate}>{formatDate(w.date)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Quick Actions</span>
        <div className={styles.quickActions}>
          <button className={styles.actionBtn} onClick={() => onNavigate('log-workout')}>
            <span className={styles.actionIcon}>🏋️</span>
            Log Workout
          </button>
          <button className={styles.actionBtn} onClick={() => onNavigate('log-stats')}>
            <span className={styles.actionIcon}>📊</span>
            Log Body Stats
          </button>
        </div>
      </div>
    </div>
  )
}
