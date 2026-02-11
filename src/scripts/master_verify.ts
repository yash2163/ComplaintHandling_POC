import { execSync } from 'child_process';

console.log('Starting Full Verification...');

try {
    // 1. Clear DB
    console.log('\n--- 1. Clearing Database ---');
    execSync('npx ts-node src/scripts/clear_database.ts', { stdio: 'inherit' });

    // 2. Seed Complaints (also clears Outlook)
    console.log('\n--- 2. Seeding Complaints ---');
    execSync('npx ts-node src/scripts/seed_and_test.ts', { stdio: 'inherit' });

    // 3. Run Worker (Ingest & Agent 1)
    console.log('\n--- 3. Running Worker (Ingestion) ---');
    execSync('npx ts-node src/scripts/run_worker_once.ts', { stdio: 'inherit' });

    // 4. Inject Resolution
    console.log('\n--- 4. Injecting Resolution ---');
    execSync('npx ts-node src/scripts/seed_dynamic_resolution.ts', { stdio: 'inherit' });

    // 5. Run Worker (Resolution & Agent 2)
    console.log('\n--- 5. Running Worker (Resolution) ---');
    execSync('npx ts-node src/scripts/run_worker_once.ts', { stdio: 'inherit' });

    console.log('\n✅ Verification Complete!');
} catch (error) {
    console.error('\n❌ Verification Failed:', error);
    process.exit(1);
}
