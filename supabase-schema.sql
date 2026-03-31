-- Run this in the Supabase SQL Editor to set up your database

-- Workouts table
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Exercises table (user's personal exercise library)
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  muscle_group text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Sets table
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.workouts(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) not null,
  exercise_name text not null,
  set_number integer not null,
  reps integer,
  weight_lbs numeric(6, 2),
  duration_seconds integer,
  notes text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.sets enable row level security;

-- Workouts RLS
create policy "Users can manage their own workouts"
  on public.workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Exercises RLS
create policy "Users can manage their own exercises"
  on public.exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sets RLS (via workout ownership)
create policy "Users can manage sets in their workouts"
  on public.sets for all
  using (
    exists (
      select 1 from public.workouts
      where workouts.id = sets.workout_id
        and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts
      where workouts.id = sets.workout_id
        and workouts.user_id = auth.uid()
    )
  );

-- Indexes for performance
create index if not exists workouts_user_id_date_idx on public.workouts (user_id, date desc);
create index if not exists sets_workout_id_idx on public.sets (workout_id);
create index if not exists exercises_user_id_idx on public.exercises (user_id);

-- ============================================================
-- Phase 2: Body Metrics
-- ============================================================

-- Body metrics table
create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  weight_lbs numeric(5, 1),
  chest_in numeric(5, 2),
  waist_in numeric(5, 2),
  hips_in numeric(5, 2),
  arms_in numeric(5, 2),
  legs_in numeric(5, 2),
  notes text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.body_metrics enable row level security;

create policy "Users can manage their own body metrics"
  on public.body_metrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for performance
create index if not exists body_metrics_user_id_date_idx on public.body_metrics (user_id, date desc);
