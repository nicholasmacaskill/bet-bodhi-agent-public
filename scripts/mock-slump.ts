import { supabaseAdmin } from '../src/lib/supabase-admin';
import 'dotenv/config';

async function main() {
    console.log("Adding 3 mock losses to trigger circuit breaker...");
    
    // 1. Get User Profile
    const { data: profiles, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
        console.error('❌ User profile not found. Cannot log mock bets.');
        return;
    }

    const userId = profiles[0].id;

    // Check if we already have mock losses to avoid endless duplication
    const { data: existing } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('research_log', 'mock_slump_test');
        
    if (existing && existing.length > 0) {
        console.log("Mock losses already exist. Cleaning them up first...");
        await supabaseAdmin.from('bets').delete().eq('research_log', 'mock_slump_test');
    }

    const mockBets = [
        {
            user_id: userId,
            team: 'Mock Slump Test Team',
            odds: 2.0,
            amount: 10,
            result: 'loss',
            research_log: 'mock_slump_test',
            pillar_focus: 'technical_sport',
            created_at: new Date(Date.now() - 3000).toISOString()
        },
        {
            user_id: userId,
            team: 'Mock Slump Test Team',
            odds: 2.0,
            amount: 10,
            result: 'loss',
            research_log: 'mock_slump_test',
            pillar_focus: 'technical_sport',
            created_at: new Date(Date.now() - 2000).toISOString()
        },
        {
            user_id: userId,
            team: 'Mock Slump Test Team',
            odds: 2.0,
            amount: 10,
            result: 'loss',
            research_log: 'mock_slump_test',
            pillar_focus: 'technical_sport',
            created_at: new Date(Date.now() - 1000).toISOString()
        }
    ];

    const { error } = await supabaseAdmin.from('bets').insert(mockBets);

    if (error) {
        console.error("Failed to insert mock bets:", error);
    } else {
        console.log("✅ Successfully inserted 3 consecutive losses.");
    }
}

main().catch(console.error);
