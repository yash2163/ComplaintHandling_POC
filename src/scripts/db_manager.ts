import { initializeDatabases, getResolutionsDb, getMasterDb } from '../agent_api/database';
import { VectorStore } from '../agent_api/vector_store';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'init') {
        console.log('Initializing databases...');
        initializeDatabases();
        console.log('Databases initialized at data/resolutions.db and data/master_table.db');
    }
    else if (command === 'view' && args[1] === 'resolutions') {
        const db = getResolutionsDb();
        const rows = db.prepare('SELECT * FROM resolutions LIMIT 50').all();
        console.table(rows);
        db.close();
    }
    else if (command === 'view' && args[1] === 'limits') {
        const db = getMasterDb();
        const rows = db.prepare('SELECT * FROM limits').all();
        console.table(rows);
        db.close();
    }
    else if (command === 'add-limit') {
        const [, , type, limit, desc] = args;
        if (!type || !limit) {
            return console.error('Usage: ts-node src/scripts/db_manager.ts add-limit <action_type> <max_percentage> "[description]"');
        }
        const db = getMasterDb();
        db.prepare('INSERT OR REPLACE INTO limits (action_type, max_allowed_percentage, description) VALUES (?, ?, ?)')
            .run(type.toLowerCase(), parseInt(limit, 10), desc || '');
        console.log(`Added/Updated limit: ${type} <= ${limit}%`);
        db.close();
    }
    else if (command === 'add-resolution') {
        // Usage: add-resolution <id> <category> <complaint> <action> <outcome> <Good/Bad>
        const [, , id, category, text, action, outcome, quality] = args;
        if (!quality) {
            return console.error('Usage: ts-node src/scripts/db_manager.ts add-resolution <id> <category> "<complaint>" "<action>" "<outcome>" <Good/Bad>');
        }
        const db = getResolutionsDb();
        db.prepare(`
        INSERT INTO resolutions (complaint_id, category, complaint_text, action_taken, outcome, quality_flag) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, category, text, action, outcome, quality);
        console.log(`Added past resolution: ${id}`);
        db.close();
    }
    else if (command === 'seed') {
        initializeDatabases();
        const resDb = getResolutionsDb();
        resDb.exec(`
        INSERT OR IGNORE INTO resolutions (complaint_id, category, complaint_text, action_taken, outcome, quality_flag) VALUES
        ('C101', 'Delay', 'My flight was delayed by 3 hours and I missed my meeting.', 'Refund', 'Offered 20% refund on ticket.', 'Good'),
        ('C102', 'Baggage', 'My luggage was torn when I received it at the belt.', 'Voucher', 'Provided $50 travel voucher.', 'Good'),
        ('C103', 'Delay', 'Flight delayed 5 hours, completely ruined my schedule!', 'Refund', 'Gave 50% refund, which was above policy.', 'Bad'),
        ('C104', 'Staff', 'The gate agent was very rude when I asked about my seat.', 'Apology', 'Sent formal apology and training warning to staff.', 'Good')
      `);
        resDb.close();

        const masterDb = getMasterDb();
        masterDb.exec(`
        INSERT OR IGNORE INTO limits (action_type, max_allowed_percentage, description) VALUES
        ('refund', 30, 'Maximum allowed refund percentage by Auto Agent'),
        ('voucher', 100, 'Max voucher limit in dollars')
      `);
        masterDb.close();
        console.log("Databases seeded with initial mock data.");

        console.log("Attempting to seed Vector Store...");
        try {
            const vs = new VectorStore();
            await vs.seedFromDatabase();
        } catch (e) {
            console.error("Failed to seed Vector Store (is Chroma running?):", e);
        }
    }
    else {
        console.log(`
Usage: ts-node src/scripts/db_manager.ts <command>

Commands:
  init                     => Create database tables if they don't exist
  seed                     => Add initial test data to DBs
  view resolutions         => Show past complaints & resolutions
  view limits              => Show agent limits (Master table)
  add-limit <type> <%> "<desc>"
  add-resolution <id> <cat> "<text>" "<action>" "<out>" <Good|Bad>
    `);
    }
}

main().catch(console.error);
