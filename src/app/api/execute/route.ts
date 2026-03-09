import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Local log for debugging if needed
const LOG_FILE = path.join(process.cwd(), 'tmp', 'execute-debug.log');

function logDebug(msg: string) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${msg}\n`;
    if (!fs.existsSync(path.dirname(LOG_FILE))) {
        fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, entry);
}

export async function GET() {
    return NextResponse.json({ status: 'active', message: 'Bodhi Execution Bridge is online.' });
}

export async function POST(req: NextRequest) {
    try {
        const { command } = await req.json();

        if (!command) {
            logDebug('ERROR: No command provided');
            return NextResponse.json({ error: 'No command provided' }, { status: 400 });
        }

        // SECURITY GUARD: Strictly whitelist commands
        const isAllowed =
            command.startsWith('npx tsx scripts/daily-scanner.ts') ||
            command.startsWith('npx tsx scripts/place-bet.ts') ||
            command.startsWith('npx tsx scripts/test-espn.ts');

        if (!isAllowed) {
            logDebug(`REJECTED: ${command}`);
            return NextResponse.json({
                error: 'Unauthorized command. Only Bodhi scripts are allowed.',
                command
            }, { status: 403 });
        }

        logDebug(`EXEC: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command);
            logDebug(`SUCCESS: ${command}`);

            return NextResponse.json({
                success: true,
                stdout,
                stderr,
                command
            });
        } catch (execError: any) {
            logDebug(`EXEC_FAIL: ${command} - ${execError.message}`);
            return NextResponse.json({
                success: false,
                error: execError.message,
                stdout: execError.stdout || '',
                stderr: execError.stderr || '',
                command
            }, { status: 500 });
        }

    } catch (error: any) {
        logDebug(`CRITICAL: ${error.message}`);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
