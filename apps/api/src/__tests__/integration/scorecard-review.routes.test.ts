import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { AuditLog } from '@/modules/audit/audit-log.model';

const app = createApp();

async function account(name: string) {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            name,
            email: `${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`,
            password: 'Password123!',
            role: 'recruiter',
        });
    return {
        token: response.body.data.token,
        organizationId: response.body.data.user.defaultOrganizationId,
    };
}

describe('Reusable scorecards and audited human review', () => {
    it('creates/applies a template and audits competency overrides without tenant leakage', async () => {
        const owner = await account('Scorecard Owner');
        const outsider = await account('Scorecard Outsider');
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'Security Engineer',
            description: 'Secure systems',
            location: 'Remote',
            requirements: ['Threat modeling'],
        });
        const candidate = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Arif Hasan',
            linkedinUrl: 'https://linkedin.com/in/arif-scorecard',
            skills: ['Threat modeling'],
            source: 'manual',
        });

        const templateRes = await request(app)
            .post('/api/scorecard-templates')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({
                name: 'Security rubric',
                roleFamily: 'Security',
                passingScore: 75,
                competencies: [
                    {
                        id: 'threat-modeling',
                        name: 'Threat modeling',
                        description: 'Identifies and mitigates threats',
                        weight: 100,
                    },
                ],
            });
        expect(templateRes.status).toBe(201);

        const isolated = await request(app)
            .get('/api/scorecard-templates')
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(isolated.body.data).toHaveLength(0);

        const applyRes = await request(app)
            .post(`/api/jobs/${job._id}/scorecard/apply-template`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ templateId: templateRes.body.data._id });
        expect(applyRes.status).toBe(200);
        expect(applyRes.body.data.name).toBe('Security rubric');

        const evaluationRes = await request(app)
            .post(`/api/jobs/${job._id}/evaluations`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ candidateId: candidate._id.toString() });
        expect(evaluationRes.status).toBe(201);

        const overrideRes = await request(app)
            .patch(`/api/evaluations/${evaluationRes.body.data._id}/override`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({
                competencyId: 'threat-modeling',
                score: 94,
                reason: 'Panel verified detailed evidence.',
            });
        expect(overrideRes.status).toBe(200);
        expect(overrideRes.body.data).toMatchObject({ overallScore: 94, reviewStatus: 'reviewed' });
        expect(overrideRes.body.data.competencyScores[0]).toMatchObject({
            humanOverrideScore: 94,
            humanOverrideReason: 'Panel verified detailed evidence.',
        });
        expect(
            await AuditLog.countDocuments({
                organizationId: owner.organizationId,
                action: 'evaluation.score_overridden',
            })
        ).toBe(1);

        const forbidden = await request(app)
            .patch(`/api/evaluations/${evaluationRes.body.data._id}/override`)
            .set('Authorization', `Bearer ${outsider.token}`)
            .send({ competencyId: 'threat-modeling', score: 10, reason: 'Unauthorized change' });
        expect(forbidden.status).toBe(404);
    });
});
