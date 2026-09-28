create table recurring_schedules (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    start_time time not null,
    end_time time not null,
    repeat_type text not null default 'none' check (repeat_type in ('none', 'daily', 'weekdays', 'weekly', 'custom')),
    repeat_days integer[] default '{}',
    created_at timestamptz not null default now()
);

create table recurring_exceptions (
    id uuid primary key default gen_random_uuid(),
    recurring_id uuid not null references recurring_schedules(id) on delete cascade,
    exception_date date not null,
    created_at timestamptz not null default now()
);
