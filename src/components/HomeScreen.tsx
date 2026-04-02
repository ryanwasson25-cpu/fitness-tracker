import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { View } from './Dashboard'
import { DumbbellIcon, ActivityIcon } from './Icons'
import styles from './HomeScreen.module.css'

interface Props {
  userId: string
  email: string
  onNavigate: (view: View) => void
}

interface HomeData {
  workoutCount: number
  totalWorkouts: number
  streakDays: number
  latestWeight: number | null
  latestBodyFat: number | null
  latestSleepScore: number | null
  latestSteps: number | null
}

interface RecentWorkout {
  id: string
  name: string
  date: string
}

const QUOTES: { text: string; author?: string }[] = [
  { text: "The only bad workout is the one that didn't happen." },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "No matter how slow you go, you're still lapping everyone on the couch." },
  { text: "The pain you feel today will be the strength you feel tomorrow." },
  { text: "It never gets easier. You just get better.", author: "Joan Benoit" },
  { text: "If you want something you've never had, you must do something you've never done." },
  { text: "Motivation gets you started. Habit keeps you going.", author: "Jim Ryun" },
  { text: "The body achieves what the mind believes." },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Strength doesn't come from what you can do. It comes from overcoming what you thought you couldn't." },
  { text: "The difference between try and triumph is a little umph." },
  { text: "Push yourself, because no one else is going to do it for you." },
  { text: "Don't wish for it. Work for it." },
  { text: "A one-hour workout is 4% of your day. No excuses." },
  { text: "Sweat is just fat crying." },
  { text: "Your future self is watching you right now through your memories." },
  { text: "Train insane or remain the same." },
  { text: "Believe in yourself and all that you are.", author: "Christian D. Larson" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Fall in love with taking care of yourself — mind, body, spirit." },
  { text: "The last three or four reps is what makes the muscle grow.", author: "Arnold Schwarzenegger" },
  { text: "Champions aren't made in gyms. Champions are made from something they have deep inside them.", author: "Muhammad Ali" },
]

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86400000)
}

function extractFirstName(email: string): string {
  if (!email) return ''
  const local = email.split('@')[0]
  const parts = local.split(/[\d.]+/).filter(Boolean)
  if (!parts[0]) return ''
  const word = parts[0]
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
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

function calculateStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // Start counting from today; if no workout today, start from yesterday
  const startDate = new Date(today)
  if (!dates.has(todayStr)) {
    startDate.setDate(startDate.getDate() - 1)
  }

  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if (dates.has(dateStr)) {
      streak++
    } else {
      break
    }
  }
  return streak
}


export default function HomeScreen({ userId, email, onNavigate }: Props) {
  const [data, setData] = useState<HomeData>({
    workoutCount: 0,
    totalWorkouts: 0,
    streakDays: 0,
    latestWeight: null,
    latestBodyFat: null,
    latestSleepScore: null,
    latestSteps: null,
  })
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [loading, setLoading] = useState(true)

  const firstName = extractFirstName(email)
  const greeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'

  const quote = QUOTES[getDayOfYear() % QUOTES.length]

  useEffect(() => {
    async function load() {
      const { start, end } = getWeekBounds()

      const [workoutsThisWeekRes, recentWorkoutsRes, latestMetricRes, allDatesRes] = await Promise.all([
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
          .select('weight_lbs, body_fat_pct, sleep_score, steps')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('workouts')
          .select('date')
          .eq('user_id', userId),
      ])

      const allDates = new Set((allDatesRes.data ?? []).map((w: { date: string }) => w.date))
      const streak = calculateStreak(allDates)
      const totalWorkouts = allDatesRes.data?.length ?? 0

      setData({
        workoutCount: workoutsThisWeekRes.count ?? 0,
        totalWorkouts,
        streakDays: streak,
        latestWeight: latestMetricRes.data?.weight_lbs ?? null,
        latestBodyFat: latestMetricRes.data?.body_fat_pct ?? null,
        latestSleepScore: latestMetricRes.data?.sleep_score ?? null,
        latestSteps: latestMetricRes.data?.steps ?? null,
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
      <div>
        <h2 className={styles.greeting}>{greeting}</h2>
        <p className={styles.quoteText}>
          <em>{quote.text}</em>
          {quote.author && <span className={styles.quoteAuthor}>— {quote.author}</span>}
        </p>
      </div>

      {/* Stats summary */}
      <div className={styles.summaryCard}>
        <p className={styles.summaryTitle}>Overview</p>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{data.workoutCount}</span>
            <span className={styles.summaryLabel}>This week</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={`${styles.summaryValue} ${data.streakDays > 0 ? styles.streakValue : ''}`}>
              {data.streakDays > 0 ? `🔥 ${data.streakDays}` : '—'}
            </span>
            <span className={styles.summaryLabel}>Day streak</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{data.totalWorkouts}</span>
            <span className={styles.summaryLabel}>Total workouts</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {data.latestWeight != null ? `${data.latestWeight}` : '—'}
            </span>
            <span className={styles.summaryLabel}>lbs</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>
              {data.latestBodyFat != null ? `${data.latestBodyFat}%` : '—'}
            </span>
            <span className={styles.summaryLabel}>Body fat</span>
          </div>
        </div>

        {(data.latestSleepScore != null || data.latestSteps != null) && (
          <div className={styles.wellnessRow}>
            {data.latestSleepScore != null && (
              <span className={styles.wellnessChip}>
                💤 Sleep {data.latestSleepScore}/100
              </span>
            )}
            {data.latestSteps != null && (
              <span className={styles.wellnessChip}>
                👟 {data.latestSteps.toLocaleString()} steps
              </span>
            )}
          </div>
        )}
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
          <button className={styles.actionBtn} onClick={() => onNavigate('log-workout-mode')}>
            <span className={styles.actionIcon}><DumbbellIcon size={28} /></span>
            Log Workout
          </button>
          <button className={styles.actionBtn} onClick={() => onNavigate('log-stats')}>
            <span className={styles.actionIcon}><ActivityIcon size={28} /></span>
            Log Body Stats
          </button>
        </div>
      </div>
    </div>
  )
}
