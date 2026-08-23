import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { EmailDelivery } from '@/modules/communications/email-delivery.model';

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

describe('Communication templates, delivery history, and interview invites', () => {
    it('renders templates, records delivery, schedules calendar invite, and isolates tenants', async () => {
        const owner = await account('Email Owner');
        const outsider = await account('Email Outsider');
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'Frontend Engineer',
            description: 'Build UI',
            location: 'Remote',
            requirements: ['React'],
        });
        const candidate = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Maliha Noor',
            email: 'maliha@example.com',
            linkedinUrl: 'https://linkedin.com/in/maliha-email',
            source: 'manual',
        });
        const interview = await Interview.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            candidateId: candidate._id,
            title: 'Technical interview',
            scheduledAt: new Date(Date.now() + 86_400_000),
            durationMinutes: 45,
            status: 'scheduled',
        });

        const templateRes = await request(app)
            .post('/api/communication-templates')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({
                name: 'Initial outreach',
                kind: 'outreach',
                subject: '{{jobTitle}} opportunity',
                body: 'Hello {{candidateName}}, discuss {{jobTitle}}?',
            });
        expect(templateRes.status).toBe(201);

        const sendRes = await request(app)
            .post(`/api/candidates/${candidate._id}/emails`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ templateId: templateRes.body.data._id });
        expect(sendRes.status).toBe(201);
        expect(sendRes.body.data).toMatchObject({
            status: 'preview',
            subject: 'Frontend Engineer opportunity',
        });

        const historyRes = await request(app)
            .get(`/api/candidates/${candidate._id}/email-deliveries`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(historyRes.body.data).toHaveLength(1);

        const isolatedRes = await request(app)
            .get(`/api/candidates/${candidate._id}/email-deliveries`)
            .set('Authorization', `Bearer ${outsider.token}`);
        expect(isolatedRes.status).toBe(404);

        const inviteRes = await request(app)
            .post(`/api/interviews/${interview._id}/invite`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(inviteRes.status).toBe(201);
        expect(inviteRes.body.data.calendarEventUrl).toContain('calendar.google.com');
        expect(await EmailDelivery.countDocuments({ candidateId: candidate._id })).toBe(2);
        const savedInterview = await Interview.findById(interview._id).lean();
        expect(savedInterview?.inviteSentAt).toBeTruthy();
    });
});
