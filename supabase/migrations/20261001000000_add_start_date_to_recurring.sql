alter table recurring_schedules
add column start_date date not null default current_date;
