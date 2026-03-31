export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      workouts: {
        Row: Workout
        Insert: WorkoutInsert
        Update: Partial<WorkoutInsert>
        Relationships: []
      }
      exercises: {
        Row: Exercise
        Insert: ExerciseInsert
        Update: Partial<ExerciseInsert>
        Relationships: []
      }
      body_metrics: {
        Row: BodyMetric
        Insert: BodyMetricInsert
        Update: Partial<BodyMetricInsert>
        Relationships: []
      }
      sets: {
        Row: WorkoutSet
        Insert: WorkoutSetInsert
        Update: Partial<WorkoutSetInsert>
        Relationships: [
          {
            foreignKeyName: 'sets_workout_id_fkey'
            columns: ['workout_id']
            isOneToOne: false
            referencedRelation: 'workouts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sets_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export interface Workout {
  id: string
  user_id: string
  name: string
  notes: string | null
  date: string
  created_at: string
}

export interface WorkoutInsert {
  user_id: string
  name: string
  notes?: string | null
  date: string
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle_group: string | null
  created_at: string
}

export interface ExerciseInsert {
  user_id: string
  name: string
  muscle_group?: string | null
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_id: string
  exercise_name: string
  set_number: number
  reps: number | null
  weight_lbs: number | null
  duration_seconds: number | null
  notes: string | null
  created_at: string
}

export interface WorkoutSetInsert {
  workout_id: string
  exercise_id: string
  exercise_name: string
  set_number: number
  reps?: number | null
  weight_lbs?: number | null
  duration_seconds?: number | null
  notes?: string | null
}

export interface BodyMetric {
  id: string
  user_id: string
  date: string
  weight_lbs: number | null
  chest_in: number | null
  waist_in: number | null
  hips_in: number | null
  arms_in: number | null
  legs_in: number | null
  notes: string | null
  created_at: string
}

export interface BodyMetricInsert {
  user_id: string
  date: string
  weight_lbs?: number | null
  chest_in?: number | null
  waist_in?: number | null
  hips_in?: number | null
  arms_in?: number | null
  legs_in?: number | null
  notes?: string | null
}
