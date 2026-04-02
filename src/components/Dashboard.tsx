import { useState, useEffect, type ReactElement } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import WorkoutList from './WorkoutList'
import WorkoutLogger, { type SetDraft, type WorkoutTemplate, type EditWorkoutData } from './WorkoutLogger'
import MetricsList from './MetricsList'
import MetricsLogger from './MetricsLogger'
import ProgressCharts from './ProgressCharts'
import HomeScreen from './HomeScreen'
import type { BodyMetric } from '../types/database'
import { HomeIcon, PlusCircleIcon, ClockIcon, TrendingUpIcon, DumbbellIcon, ActivityIcon, PlusSquareIcon, RepeatIcon } from './Icons'
import styles from './Dashboard.module.css'

interface Props {
  session: Session
}

export type View =
  | 'home'
  | 'log'
  | 'log-workout-mode'
  | 'log-workout'
  | 'log-stats'
  | 'repeat-workout'
  | 'history'
  | 'progress'
  | 'edit-workout'
  | 'edit-stats'

const TABS: { id: View; icon: ReactElement; label: string }[] = [
  { id: 'home', icon: <HomeIcon />, label: 'Home' },
  { id: 'log', icon: <PlusCircleIcon />, label: 'Log' },
  { id: 'history', icon: <ClockIcon />, label: 'History' },
  { id: 'progress', icon: <TrendingUpIcon />, label: 'Progress' },
]

type HistoryTab = 'workouts' | 'stats'

function LogView({ onSelect }: { onSelect: (v: View) => void }) {
  return (
    <div className={styles.logView}>
      <h2 className={styles.logHeading}>What would you like to log?</h2>
      <div className={styles.logCards}>
        <button className={styles.logCard} onClick={() => onSelect('log-workout-mode')}>
          <span className={styles.logCardIcon}><DumbbellIcon size={40} /></span>
          <span className={styles.logCardTitle}>Log Workout</span>
          <span className={styles.logCardDesc}>Record exercises, sets, and reps</span>
        </button>
        <button className={styles.logCard} onClick={() => onSelect('log-stats')}>
          <span className={styles.logCardIcon}><ActivityIcon size={40} /></span>
          <span className={styles.logCardTitle}>Log Body Stats</span>
          <span className={styles.logCardDesc}>Track weight and body fat %</span>
        </button>
      </div>
    </div>
  )
}

function WorkoutModeView({
  userId,
  onSelect,
  onBack,
}: {
  userId: string
  onSelect: (v: View) => void
  onBack: () => void
}) {
  const [recentNames, setRecentNames] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('workouts')
      .select('name')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setRecentNames((data ?? []).map((w: { name: string }) => w.name))
      })
  }, [userId])

  return (
    <div className={styles.logView}>
      <div className={styles.modeHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 className={styles.logHeading}>Log Workout</h2>
      </div>
      <div className={styles.logCards}>
        <button className={styles.logCard} onClick={() => onSelect('log-workout')}>
          <span className={styles.logCardIcon}><PlusSquareIcon size={40} /></span>
          <span className={styles.logCardTitle}>Start Fresh</span>
          <span className={styles.logCardDesc}>Begin a new blank workout</span>
        </button>
        <button className={styles.logCard} onClick={() => onSelect('repeat-workout')}>
          <span className={styles.logCardIcon}><RepeatIcon size={40} /></span>
          <span className={styles.logCardTitle}>Repeat Previous</span>
          <span className={styles.logCardDesc}>Copy a recent workout as a template</span>
          {recentNames.length > 0 && (
            <div className={styles.recentPreview}>
              {recentNames.map((name, i) => (
                <span key={i} className={styles.recentPreviewItem}>{name}</span>
              ))}
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

interface RecentWorkoutItem {
  id: string
  name: string
  date: string
}

function RepeatWorkoutPicker({
  userId,
  onSelect,
  onBack,
}: {
  userId: string
  onSelect: (template: WorkoutTemplate) => void
  onBack: () => void
}) {
  const [workouts, setWorkouts] = useState<RecentWorkoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('workouts')
      .select('id, name, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setWorkouts(data ?? [])
        setLoading(false)
      })
  }, [userId])

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  async function handleSelect(workout: RecentWorkoutItem) {
    setLoadingId(workout.id)
    const { data } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_id', workout.id)
      .order('set_number', { ascending: true })

    const initialSets: SetDraft[] = (data ?? []).map((s: {
      exercise_name: string
      set_number: number
      reps: number | null
      weight_lbs: number | null
    }) => ({
      id: crypto.randomUUID(),
      exercise_name: s.exercise_name,
      set_number: s.set_number,
      reps: s.reps?.toString() ?? '',
      weight_lbs: s.weight_lbs?.toString() ?? '',
    }))

    onSelect({ name: workout.name, initialSets })
    setLoadingId(null)
  }

  return (
    <div className={styles.logView}>
      <div className={styles.repeatHeader}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <h2 className={styles.repeatHeading}>Choose a Workout</h2>
      </div>

      {loading ? (
        <p className={styles.repeatLoading}>Loading…</p>
      ) : workouts.length === 0 ? (
        <p className={styles.repeatEmpty}>No previous workouts found.</p>
      ) : (
        <div className={styles.repeatList}>
          {workouts.map(w => (
            <button
              key={w.id}
              className={styles.repeatCard}
              onClick={() => handleSelect(w)}
              disabled={loadingId !== null}
            >
              <div className={styles.repeatCardInfo}>
                <span className={styles.repeatCardName}>{w.name}</span>
                <span className={styles.repeatCardDate}>{formatDate(w.date)}</span>
              </div>
              <span className={styles.repeatCardArrow}>
                {loadingId === w.id ? '…' : '→'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryView({
  userId,
  workoutRefreshKey,
  metricsRefreshKey,
  onStartLog,
  onEditWorkout,
  onEditMetric,
}: {
  userId: string
  workoutRefreshKey: number
  metricsRefreshKey: number
  onStartLog: () => void
  onEditWorkout: (data: EditWorkoutData) => void
  onEditMetric: (entry: BodyMetric) => void
}) {
  const [tab, setTab] = useState<HistoryTab>('workouts')

  return (
    <div>
      <div className={styles.historyToggle}>
        <button
          className={`${styles.toggleBtn} ${tab === 'workouts' ? styles.toggleActive : ''}`}
          onClick={() => setTab('workouts')}
        >
          Workouts
        </button>
        <button
          className={`${styles.toggleBtn} ${tab === 'stats' ? styles.toggleActive : ''}`}
          onClick={() => setTab('stats')}
        >
          Body Stats
        </button>
      </div>

      {tab === 'workouts' && (
        <WorkoutList
          userId={userId}
          key={workoutRefreshKey}
          onStartLog={onStartLog}
          onEdit={onEditWorkout}
        />
      )}
      {tab === 'stats' && (
        <MetricsList
          userId={userId}
          key={metricsRefreshKey}
          onStartLog={onStartLog}
          onEdit={onEditMetric}
        />
      )}
    </div>
  )
}

export default function Dashboard({ session }: Props) {
  const [view, setView] = useState<View>('home')
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0)
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0)
  const [workoutTemplate, setWorkoutTemplate] = useState<WorkoutTemplate | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<EditWorkoutData | null>(null)
  const [editingMetric, setEditingMetric] = useState<BodyMetric | null>(null)

  function handleWorkoutSaved() {
    setWorkoutTemplate(null)
    setEditingWorkout(null)
    setWorkoutRefreshKey(k => k + 1)
    setView('history')
  }

  function handleMetricsSaved() {
    setEditingMetric(null)
    setMetricsRefreshKey(k => k + 1)
    setView('history')
  }

  function handleRepeatSelect(template: WorkoutTemplate) {
    setWorkoutTemplate(template)
    setView('log-workout')
  }

  function handleEditWorkout(data: EditWorkoutData) {
    setEditingWorkout(data)
    setView('edit-workout')
  }

  function handleEditMetric(entry: BodyMetric) {
    setEditingMetric(entry)
    setView('edit-stats')
  }

  const activeTab: View =
    view === 'log-workout' || view === 'log-stats' || view === 'log-workout-mode' || view === 'repeat-workout'
      ? 'log'
      : view === 'edit-workout' || view === 'edit-stats'
      ? 'history'
      : view

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Fitness Tracker</h1>
        <button
          className={styles.signOut}
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        <div key={view} className={styles.viewContent}>
          {view === 'home' && (
            <HomeScreen userId={session.user.id} email={session.user.email ?? ''} onNavigate={setView} />
          )}
          {view === 'log' && (
            <LogView onSelect={setView} />
          )}
          {view === 'log-workout-mode' && (
            <WorkoutModeView
              userId={session.user.id}
              onSelect={setView}
              onBack={() => setView('log')}
            />
          )}
          {view === 'log-workout' && (
            <WorkoutLogger
              userId={session.user.id}
              onSaved={handleWorkoutSaved}
              onCancel={() => { setWorkoutTemplate(null); setView('log') }}
              template={workoutTemplate ?? undefined}
            />
          )}
          {view === 'edit-workout' && editingWorkout && (
            <WorkoutLogger
              userId={session.user.id}
              onSaved={handleWorkoutSaved}
              onCancel={() => { setEditingWorkout(null); setView('history') }}
              editWorkout={editingWorkout}
            />
          )}
          {view === 'repeat-workout' && (
            <RepeatWorkoutPicker
              userId={session.user.id}
              onSelect={handleRepeatSelect}
              onBack={() => setView('log-workout-mode')}
            />
          )}
          {view === 'log-stats' && (
            <MetricsLogger
              userId={session.user.id}
              onSaved={handleMetricsSaved}
              onCancel={() => setView('log')}
            />
          )}
          {view === 'edit-stats' && editingMetric && (
            <MetricsLogger
              userId={session.user.id}
              onSaved={handleMetricsSaved}
              onCancel={() => { setEditingMetric(null); setView('history') }}
              editMetric={editingMetric}
            />
          )}
          {view === 'history' && (
            <HistoryView
              userId={session.user.id}
              workoutRefreshKey={workoutRefreshKey}
              metricsRefreshKey={metricsRefreshKey}
              onStartLog={() => setView('log')}
              onEditWorkout={handleEditWorkout}
              onEditMetric={handleEditMetric}
            />
          )}
          {view === 'progress' && (
            <ProgressCharts userId={session.user.id} />
          )}
        </div>
      </main>

      <nav className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setView(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
