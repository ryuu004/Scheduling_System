create table if not exists schedules (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    date date not null,
    start_time time not null,
    end_time time not null,
    created_at timestamptz not null default now()
);
