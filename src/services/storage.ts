import fs from 'fs/promises';
import path from 'path';
import { NormalizedEmail, CaseFile } from '../types/domain';

export class StorageService {
    private baseDir: string;

    constructor(baseDir: string = './data') {
        this.baseDir = baseDir;
    }

    async init() {
        await fs.mkdir(path.join(this.baseDir, 'raw_emails'), { recursive: true });
        await fs.mkdir(path.join(this.baseDir, 'cases'), { recursive: true });
    }

    async saveRawEmail(email: NormalizedEmail) {
        const filename = `${email.id}.json`;
        await fs.writeFile(
            path.join(this.baseDir, 'raw_emails', filename),
            JSON.stringify(email, null, 2)
        );
    }

    async saveCase(caseFile: CaseFile) {
        const filename = `${caseFile.caseId}.json`;
        await fs.writeFile(
            path.join(this.baseDir, 'cases', filename),
            JSON.stringify(caseFile, null, 2)
        );
    }

    async getCase(caseId: string): Promise<CaseFile | null> {
        try {
            const data = await fs.readFile(path.join(this.baseDir, 'cases', `${caseId}.json`), 'utf-8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    async getRawEmail(id: string): Promise<NormalizedEmail | null> {
        try {
            const data = await fs.readFile(path.join(this.baseDir, 'raw_emails', `${id}.json`), 'utf-8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
}
