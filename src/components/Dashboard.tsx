import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import WorkoutList from './WorkoutList'
import WorkoutLogger from './WorkoutLogger'
import MetricsList from './MetricsList'
import MetricsLogger from './MetricsLogger'
import ProgressCharts from './ProgressCharts'
import styles from './Dashboard.module.css'

interface Props {
  session: Session
}

export type View = 'history' | 'log' | 'metrics' | 'log-metrics' | 'progress'

const TABS: { id: View; icon: string; label: string }[] = [
  { id: 'history', icon: '📋', label: 'Workouts' },
  { id: 'log', icon: '➕', label: 'Log' },
  { id: 'metrics', icon: '📏', label: 'Body' },
  { id: 'log-metrics', icon: '📝', label: 'Metrics' },
  { id: 'progress', icon: '📊', label: 'Progress' },
]

export default function Dashboard({ session }: Props) {
  const [view, setView] = useState<View>('history')
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0)
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0)

  function handleWorkoutSaved() {
    setWorkoutRefreshKey(k => k + 1)
    setView('history')
  }

  function handleMetricsSaved() {
    setMetricsRefreshKey(k => k + 1)
    setView('metrics')
  }

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
        {view === 'history' && (
          <WorkoutList
            userId={session.user.id}
            key={workoutRefreshKey}
            onStartLog={() => setView('log')}
          />
        )}
        {view === 'log' && (
          <WorkoutLogger
            userId={session.user.id}
            onSaved={handleWorkoutSaved}
            onCancel={() => setView('history')}
          />
        )}
        {view === 'metrics' && (
          <MetricsList
            userId={session.user.id}
            key={metricsRefreshKey}
            onStartLog={() => setView('log-metrics')}
          />
        )}
        {view === 'log-metrics' && (
          <MetricsLogger
            userId={session.user.id}
            onSaved={handleMetricsSaved}
            onCancel={() => setView('metrics')}
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
            className={`${styles.tabBtn} ${view === tab.id ? styles.tabActive : ''}`}
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
