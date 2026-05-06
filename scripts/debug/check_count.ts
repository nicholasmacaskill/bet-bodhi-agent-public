import { supabaseAdmin } from '../../src/lib/supabase-admin';
import 'dotenv/config';
async function main() {
  const { count, error } = await supabaseAdmin.from('bets').select('*', { count: 'exact', head: true });
  console.log("Total bets in DB:", count);
  console.log("Error:", error);
}
main();
