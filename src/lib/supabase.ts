import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lyvdtussfdwfuscbdzrr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5dmR0dXNzZmR3ZnVzY2JkenJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MjE5NzAsImV4cCI6MjEwNjA5Nzk3MH0.Ifi23VPLtF8ehdAOtd9ninX5jwvkqSuyDnqCAzVGBW0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
