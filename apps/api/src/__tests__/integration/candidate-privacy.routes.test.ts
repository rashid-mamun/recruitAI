import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Message } from '@/modules/candidates/message.model';

const app = createApp();

async function register(label: string) {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            name: label,
            email: `${label.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`,
            password: 'Password123!',
            role: 'recruiter',
        });
    return {
        token: response.body.data.token as string,
        organizationId: response.body.data.user.defaultOrganizationId as string,
    };
}

describe('Candidate duplicate, merge, export, and privacy deletion', () => {
    it('keeps the lifecycle tenant-scoped and moves related records during merge', async () => {
        const owner = await register('Privacy Owner');
        const outsider = await register('Privacy Outsider');
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'Platform Engineer',
            description: 'Build the platform.',
            location: 'Remote',
            requirements: ['Node.js'],
        });
        const primary = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Samira Khan',
            email: 'samira@example.com',
            linkedinUrl: 'https://linkedin.com/in/samira-primary',
            currentCompany: 'Acme',
            currentTitle: 'Engineer',
            tags: ['priority'],
            source: 'manual',
        });
        const duplicate = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Samira Khan',
            email: 'samira@example.com',
            linkedinUrl: 'https://linkedin.com/in/samira-duplicate',
            currentCompany: 'Acme',
            currentTitle: 'Engineer',
            phone: '+8801700000000',
            tags: ['backend'],
            source: 'manual',
        });
        await Message.create({
            candidateId: duplicate._id,
            jobId: job._id,
            content: 'Interested',
            role: 'candidate',
        });

        const duplicateRes = await request(app)
            .get(`/api/candidates/${primary._id}/duplicates`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(duplicateRes.status).toBe(200);
        expect(duplicateRes.body.data.map((item: any) => item._id)).toContain(
            duplicate._id.toString()
        );

        const forbiddenExport = await request(app)
            .get(`/api/candidates/${primary._id}/export`)
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(forbiddenExport.status).toBe(404);

        const mergeRes = await request(app)
            .post(`/api/candidates/${primary._id}/merge`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ duplicateCandidateId: duplicate._id.toString() });
        expect(mergeRes.status).toBe(200);
        expect(mergeRes.body.data.phone).toBe('+8801700000000');
        expect(mergeRes.body.data.tags).toEqual(expect.arrayContaining(['priority', 'backend']));
        expect(await Candidate.findById(duplicate._id)).toBeNull();
        expect(await Message.countDocuments({ candidateId: primary._id })).toBe(1);

        const exportRes = await request(app)
            .get(`/api/candidates/${primary._id}/export`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(exportRes.status).toBe(200);
        expect(exportRes.body.data.candidate._id).toBe(primary._id.toString());
        expect(exportRes.body.data.messages).toHaveLength(1);

        const deleteRes = await request(app)
            .delete(`/api/candidates/${primary._id}`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(deleteRes.status).toBe(204);
        expect(await Candidate.findById(primary._id)).toBeNull();
        expect(await Message.countDocuments({ candidateId: primary._id })).toBe(0);
    });
});
