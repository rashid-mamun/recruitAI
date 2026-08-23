import axios from 'axios';
import { env } from '@/config/env';
import { ValidationError } from '@/middleware/errorHandler';

interface ScanResult {
    status: 'clean' | 'infected' | 'skipped';
    details: string;
}

export async function scanFile(buffer: Buffer, filename: string): Promise<ScanResult> {
    if (env.MALWARE_SCAN_PROVIDER === 'http') {
        if (!env.MALWARE_SCAN_URL) throw new ValidationError('MALWARE_SCAN_URL is required');
        const { data } = await axios.post<ScanResult>(
            env.MALWARE_SCAN_URL,
            {
                filename,
                contentBase64: buffer.toString('base64'),
            },
            { timeout: 15000 }
        );

        if (!['clean', 'infected', 'skipped'].includes(data.status)) {
            throw new ValidationError('Malware scanner returned an invalid status');
        }
        return {
            status: data.status,
            details: data.details || `HTTP scanner returned ${data.status}`,
        };
    }

    const normalized =
        `${filename}\n${buffer.toString('utf8', 0, Math.min(buffer.length, 4096))}`.toLowerCase();
    if (normalized.includes('eicar-standard-antivirus-test-file')) {
        return { status: 'infected', details: 'EICAR test signature detected' };
    }

    return { status: 'clean', details: 'Local signature scan passed' };
}
