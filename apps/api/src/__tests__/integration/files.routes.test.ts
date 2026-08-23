import request from 'supertest';
import { createApp } from '@/app';
import { Candidate } from '@/modules/candidates/candidate.model';
import { FileAsset } from '@/modules/files/file-asset.model';
import { Job } from '@/modules/jobs/job.model';

const app = createApp();

describe('File Routes (Resume Upload Flow)', () => {
    let token: string;
    let organizationId: string;
    let candidateId: string;

    beforeEach(async () => {
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'File Tester',
                email: `files-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        token = authRes.body.data.token;
        organizationId = authRes.body.data.user.defaultOrganizationId;

        const job = await Job.create({
            organizationId,
            title: 'Frontend Engineer',
            description: 'Build production React experiences.',
            location: 'Remote',
            requirements: ['React', 'TypeScript', 'Accessibility'],
        });

        const candidate = await Candidate.create({
            organizationId,
            jobId: job._id,
            name: 'Samira Khan',
            email: 'samira@example.com',
            linkedinUrl: 'https://linkedin.com/in/samira-khan',
            headline: 'Frontend Engineer',
            summary: 'Builds polished product UI.',
            skills: ['React', 'TypeScript'],
            experience: '5 years',
            location: 'Remote',
            source: 'manual',
            status: 'sourced',
        });
        candidateId = candidate._id.toString();
    });

    it('uploads, links, lists, and downloads a candidate resume', async () => {
        const resumeText = 'Samira Khan resume with React, TypeScript, and accessibility work.';

        const uploadRes = await request(app)
            .post('/api/files')
            .set('Authorization', `Bearer ${token}`)
            .send({
                ownerType: 'candidate',
                ownerId: candidateId,
                kind: 'resume',
                filename: 'samira-resume.txt',
                mimeType: 'text/plain',
                contentBase64: Buffer.from(resumeText).toString('base64'),
            });

        expect(uploadRes.status).toBe(201);
        expect(uploadRes.body.success).toBe(true);
        expect(uploadRes.body.data).toMatchObject({
            ownerType: 'candidate',
            kind: 'resume',
            filename: 'samira-resume.txt',
            mimeType: 'text/plain',
            size: Buffer.byteLength(resumeText),
            storageProvider: 'local',
            scanStatus: 'clean',
        });
        expect(uploadRes.body.data.extractedText).toContain('accessibility');

        const fileId = uploadRes.body.data._id;
        const savedCandidate = await Candidate.findById(candidateId).lean();
        expect(savedCandidate?.resumeFileId?.toString()).toBe(fileId);
        expect(savedCandidate?.resumeText).toContain('React');

        const listRes = await request(app)
            .get(`/api/files?ownerType=candidate&ownerId=${candidateId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data).toHaveLength(1);
        expect(listRes.body.data[0]._id).toBe(fileId);

        const downloadRes = await request(app)
            .get(`/api/files/${fileId}/download`)
            .set('Authorization', `Bearer ${token}`);

        expect(downloadRes.status).toBe(200);
        expect(downloadRes.headers['content-type']).toContain('text/plain');
        expect(downloadRes.headers['content-disposition']).toContain('samira-resume.txt');
        expect(downloadRes.text).toContain('TypeScript');

        const savedAsset = await FileAsset.findById(fileId).lean();
        expect(savedAsset?.checksum).toHaveLength(64);
    });

    it('rejects unauthenticated file access', async () => {
        const res = await request(app).get(`/api/files?ownerType=candidate&ownerId=${candidateId}`);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('rejects unsupported resume file types', async () => {
        const res = await request(app)
            .post('/api/files')
            .set('Authorization', `Bearer ${token}`)
            .send({
                ownerType: 'candidate',
                ownerId: candidateId,
                kind: 'resume',
                filename: 'resume.exe',
                mimeType: 'application/x-msdownload',
                contentBase64: Buffer.from('not a resume').toString('base64'),
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects files with a malware test signature', async () => {
        const res = await request(app)
            .post('/api/files')
            .set('Authorization', `Bearer ${token}`)
            .send({
                ownerType: 'candidate',
                ownerId: candidateId,
                kind: 'resume',
                filename: 'eicar.txt',
                mimeType: 'text/plain',
                contentBase64: Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE').toString('base64'),
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('malware scan');
    });
});
