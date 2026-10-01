create table activity_logs (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    planned_date date not null,
    planned_start_time time not null,
    planned_end_time time not null,
    actual_start_time time,
    actual_end_time time,
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
    created_at timestamptz not null default now()
);
