import postgres from 'postgres';

const connectionString = 'postgresql://postgres.lyvdtussfdwfuscbdzrr:rhyiotahari123@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const sql = postgres(connectionString);

async function migrate() {
  try {
    await sql`
      create table if not exists schedules (
        id uuid primary key default gen_random_uuid(),
        title text not null,
        date date not null,
        start_time time not null,
        end_time time not null,
        created_at timestamptz not null default now()
      )
    `;
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
