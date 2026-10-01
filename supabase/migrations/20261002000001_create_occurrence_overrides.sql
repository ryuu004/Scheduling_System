create table occurrence_overrides (
    id uuid primary key default gen_random_uuid(),
    recurring_id uuid not null references recurring_schedules(id) on delete cascade,
    override_date date not null,
    start_time time not null,
    end_time time not null,
    created_at timestamptz not null default now()
);
