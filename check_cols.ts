import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function main() {
    const { data, error } = await supabaseAdmin.from('bets').select('*').limit(1);
    if (error) { console.error("Error", error); return; }
    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("No data, cannot infer columns purely from select.");
    }
}
main();
