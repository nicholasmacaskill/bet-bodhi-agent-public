import * as fs from 'fs';
import * as path from 'path';
import { db, initDb } from '../src/lib/sqlite-client';

async function importBackup() {
    console.log("🛠️  Initializing local SQLite database schema...");
    initDb();

    const dateStr = '2026-05-22';
    const backupDir = path.resolve(process.cwd(), 'backup', dateStr);

    if (!fs.existsSync(backupDir)) {
        console.error(`❌ Backup directory not found: ${backupDir}`);
        process.exit(1);
    }

    console.log(`📂 Importing backups from ${backupDir}...`);

    // 1. Import user_profiles
    const profilesPath = path.join(backupDir, 'user_profiles.json');
    if (fs.existsSync(profilesPath)) {
        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
        console.log(`👤 Importing ${profiles.length} user profiles...`);
        const insertProfile = db.prepare(`
            INSERT OR REPLACE INTO user_profiles (id, archetype, peak_watermark_balance, current_balance, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const p of profiles) {
            insertProfile.run(p.id, p.archetype, p.peak_watermark_balance, p.current_balance, p.updated_at);
        }
    }

    // 2. Import bets
    const betsPath = path.join(backupDir, 'bets.json');
    if (fs.existsSync(betsPath)) {
        const bets = JSON.parse(fs.readFileSync(betsPath, 'utf8'));
        console.log(`🎲 Importing ${bets.length} bets...`);
        const insertBet = db.prepare(`
            INSERT OR REPLACE INTO bets (
                id, user_id, team, odds, amount, emotional_pulse, physiological_score,
                research_log, pillar_focus, created_at, updated_at, result,
                external_id, platform, time_to_kickoff_minutes, motivation_tag, payout
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        db.transaction((betsList: any[]) => {
            for (const b of betsList) {
                insertBet.run(
                    b.id, b.user_id, b.team, b.odds, b.amount, b.emotional_pulse, b.physiological_score,
                    b.research_log, b.pillar_focus, b.created_at, b.updated_at, b.result,
                    b.external_id, b.platform, b.time_to_kickoff_minutes, b.motivation_tag, b.payout
                );
            }
        })(bets);
    }

    // 3. Import betting_opportunities
    const opportunitiesPath = path.join(backupDir, 'betting_opportunities.json');
    if (fs.existsSync(opportunitiesPath)) {
        const opportunities = JSON.parse(fs.readFileSync(opportunitiesPath, 'utf8'));
        console.log(`🎯 Importing ${opportunities.length} betting opportunities...`);
        const insertOpportunity = db.prepare(`
            INSERT OR REPLACE INTO betting_opportunities (
                id, game_pk, game_date, matchup, confidence_score, pillar_breakdown,
                home_ml_odds, away_ml_odds, detected_value_team, status, actual_bet_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        db.transaction((oppsList: any[]) => {
            for (const o of oppsList) {
                insertOpportunity.run(
                    o.id, o.game_pk, o.game_date, o.matchup, o.confidence_score,
                    o.pillar_breakdown ? JSON.stringify(o.pillar_breakdown) : null,
                    o.home_ml_odds, o.away_ml_odds, o.detected_value_team, o.status, o.actual_bet_id, o.created_at
                );
            }
        })(opportunities);
    }

    console.log("✨ Data import completed successfully!");
    
    // Quick verification check
    const profileCount = db.prepare("SELECT COUNT(*) as count FROM user_profiles").get() as any;
    const betCount = db.prepare("SELECT COUNT(*) as count FROM bets").get() as any;
    const oppCount = db.prepare("SELECT COUNT(*) as count FROM betting_opportunities").get() as any;
    
    console.log(`📊 DB Counts: Profiles: ${profileCount.count} | Bets: ${betCount.count} | Opportunities: ${oppCount.count}`);
}

importBackup().catch(console.error);
