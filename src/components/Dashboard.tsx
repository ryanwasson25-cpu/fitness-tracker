import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import WorkoutList from './WorkoutList'
import WorkoutLogger from './WorkoutLogger'
import MetricsList from './MetricsList'
import MetricsLogger from './MetricsLogger'
import ProgressCharts from './ProgressCharts'
import HomeScreen from './HomeScreen'
import styles from './Dashboard.module.css'

interface Props {
  session: Session
}

export type View = 'home' | 'log' | 'log-workout' | 'log-stats' | 'history' | 'progress'

const TABS: { id: View; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'log', icon: '➕', label: 'Log' },
  { id: 'history', icon: '📋', label: 'History' },
  { id: 'progress', icon: '📊', label: 'Progress' },
]

type HistoryTab = 'workouts' | 'stats'

function LogView({ onSelect }: { onSelect: (v: View) => void }) {
  return (
    <div className={styles.logView}>
      <h2 className={styles.logHeading}>What would you like to log?</h2>
      <div className={styles.logCards}>
        <button className={styles.logCard} onClick={() => onSelect('log-workout')}>
          <span className={styles.logCardIcon}>🏋️</span>
          <span className={styles.logCardTitle}>Log Workout</span>
          <span className={styles.logCardDesc}>Record exercises, sets, and reps</span>
        </button>
        <button className={styles.logCard} onClick={() => onSelect('log-stats')}>
          <span className={styles.logCardIcon}>📊</span>
          <span className={styles.logCardTitle}>Log Body Stats</span>
          <span className={styles.logCardDesc}>Track weight and body fat %</span>
        </button>
      </div>
    </div>
  )
}

function HistoryView({
  userId,
  workoutRefreshKey,
  metricsRefreshKey,
  onStartLog,
}: {
  userId: string
  workoutRefreshKey: number
  metricsRefreshKey: number
  onStartLog: () => void
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
        />
      )}
      {tab === 'stats' && (
        <MetricsList
          userId={userId}
          key={metricsRefreshKey}
          onStartLog={onStartLog}
        />
      )}
    </div>
  )
}

export default function Dashboard({ session }: Props) {
  const [view, setView] = useState<View>('home')
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0)
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0)

  function handleWorkoutSaved() {
    setWorkoutRefreshKey(k => k + 1)
    setView('history')
  }

  function handleMetricsSaved() {
    setMetricsRefreshKey(k => k + 1)
    setView('history')
  }

  const activeTab: View =
    view === 'log-workout' || view === 'log-stats' ? 'log' : view

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
        {view === 'home' && (
          <HomeScreen userId={session.user.id} onNavigate={setView} />
        )}
        {view === 'log' && (
          <LogView onSelect={setView} />
        )}
        {view === 'log-workout' && (
          <WorkoutLogger
            userId={session.user.id}
            onSaved={handleWorkoutSaved}
            onCancel={() => setView('log')}
          />
        )}
        {view === 'log-stats' && (
          <MetricsLogger
            userId={session.user.id}
            onSaved={handleMetricsSaved}
            onCancel={() => setView('log')}
          />
        )}
        {view === 'history' && (
          <HistoryView
            userId={session.user.id}
            workoutRefreshKey={workoutRefreshKey}
            metricsRefreshKey={metricsRefreshKey}
            onStartLog={() => setView('log')}
          />
        )}
        {view === 'progress' && (
          <ProgressCharts userId={session.user.id} />
        )}
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
