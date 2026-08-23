import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { AuditLog } from '@/modules/audit/audit-log.model';

const app = createApp();

describe('Collaboration Routes (Comments, Reviews, Audit Logs)', () => {
    let token: string;
    let organizationId: string;
    let candidateId: string;

    beforeEach(async () => {
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Collaboration Tester',
                email: `collab-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        token = authRes.body.data.token;
        organizationId = authRes.body.data.user.defaultOrganizationId;

        const job = await Job.create({
            organizationId,
            title: 'Staff Engineer',
            description: 'Lead complex projects and mentor teams.',
            location: 'Remote',
            requirements: ['Architecture', 'Mentoring'],
        });

        const candidate = await Candidate.create({
            organizationId,
            jobId: job._id,
            name: 'Samira Chowdhury',
            linkedinUrl: 'https://linkedin.com/in/samira-chowdhury',
            headline: 'Staff Engineer',
            summary: 'Architecture lead and mentor.',
            skills: ['Architecture', 'Mentoring'],
            experience: '10 years',
            location: 'Remote',
            source: 'manual',
            status: 'scored',
        });
        candidateId = candidate._id.toString();
    });

    it('creates comments, creates and updates reviews, and records audit logs', async () => {
        const commentRes = await request(app)
            .post(`/api/collaboration/candidate/${candidateId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ body: 'Panel liked the architecture depth.', visibility: 'team' });

        expect(commentRes.status).toBe(201);
        expect(commentRes.body.data).toMatchObject({
            resourceType: 'candidate',
            body: 'Panel liked the architecture depth.',
            visibility: 'team',
        });

        const commentsRes = await request(app)
            .get(`/api/collaboration/candidate/${candidateId}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(commentsRes.status).toBe(200);
        expect(commentsRes.body.data).toHaveLength(1);

        const reviewRes = await request(app)
            .post(`/api/collaboration/candidate/${candidateId}/reviews`)
            .set('Authorization', `Bearer ${token}`)
            .send({ note: 'Needs hiring manager approval.' });

        expect(reviewRes.status).toBe(201);
        expect(reviewRes.body.data.status).toBe('open');

        const reviewId = reviewRes.body.data._id;

        const updateReviewRes = await request(app)
            .patch(`/api/collaboration/reviews/${reviewId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                status: 'approved',
                decision: 'yes',
                note: 'Approved for final round.',
            });

        expect(updateReviewRes.status).toBe(200);
        expect(updateReviewRes.body.data).toMatchObject({
            status: 'approved',
            decision: 'yes',
            note: 'Approved for final round.',
        });
        expect(updateReviewRes.body.data.reviewedAt).toBeTruthy();

        const candidateUpdateRes = await request(app)
            .patch(`/api/candidates/${candidateId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ tags: ['finalist'], starred: true });

        expect(candidateUpdateRes.status).toBe(200);
        expect(candidateUpdateRes.body.data.tags).toContain('finalist');

        const auditRes = await request(app)
            .get(`/api/audit-logs?resourceType=candidate&resourceId=${candidateId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(auditRes.status).toBe(200);
        const actions = auditRes.body.data.map((item: any) => item.action);
        expect(actions).toEqual(
            expect.arrayContaining([
                'comment.created',
                'review.created',
                'review.updated',
                'candidate.updated',
            ])
        );

        const auditCount = await AuditLog.countDocuments({
            resourceType: 'candidate',
            resourceId: candidateId,
        });
        expect(auditCount).toBeGreaterThanOrEqual(4);
    });

    it('rejects collaboration access without auth', async () => {
        const res = await request(app).get(`/api/collaboration/candidate/${candidateId}/comments`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});
