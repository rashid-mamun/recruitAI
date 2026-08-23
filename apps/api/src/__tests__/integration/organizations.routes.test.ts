import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Organization } from '@/modules/organizations/organization.model';
import { Membership } from '@/modules/organizations/membership.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { Task } from '@/modules/tasks/task.model';

const app = createApp();

describe('Organization tenancy flow', () => {
    async function register(email: string) {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: email.split('@')[0],
                email,
                password: 'Password123!',
                role: 'recruiter',
            });
        expect(res.status).toBe(201);
        return {
            token: res.body.data.token as string,
            user: res.body.data.user,
            organizationId: res.body.data.user.defaultOrganizationId as string,
        };
    }

    it('creates a default organization and scopes jobs to the signed-in workspace', async () => {
        const alice = await register(`alice-${Date.now()}@example.com`);
        const bob = await register(`bob-${Date.now()}@example.com`);

        expect(alice.organizationId).toBeTruthy();
        expect(bob.organizationId).toBeTruthy();
        expect(alice.organizationId).not.toBe(bob.organizationId);

        expect(await Organization.findById(alice.organizationId)).toBeTruthy();
        expect(
            await Membership.findOne({
                organizationId: alice.organizationId,
                userId: alice.user.id,
                status: 'active',
            })
        ).toBeTruthy();
        expect(
            await Membership.findOne({
                organizationId: bob.organizationId,
                userId: bob.user.id,
                role: 'owner',
                status: 'active',
            })
        ).toBeTruthy();

        const createJobRes = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({
                title: 'Tenant Scoped Engineer',
                description: 'Build isolated product features.',
                requirements: ['Node.js'],
                location: 'Remote',
            });

        expect(createJobRes.status).toBe(201);
        expect(createJobRes.body.data.organizationId).toBe(alice.organizationId);

        const aliceJobs = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${alice.token}`);

        expect(aliceJobs.status).toBe(200);
        expect(aliceJobs.body.data.map((job: any) => job._id)).toContain(
            createJobRes.body.data._id
        );

        const candidate = await Candidate.create({
            organizationId: alice.organizationId,
            jobId: createJobRes.body.data._id,
            name: 'Alice Candidate',
            linkedinUrl: `https://linkedin.com/in/alice-${Date.now()}`,
            status: 'sourced',
        });
        await Interview.create({
            organizationId: alice.organizationId,
            jobId: createJobRes.body.data._id,
            candidateId: candidate._id,
            title: 'Alice private interview',
        });
        const aliceTask = await Task.create({
            organizationId: alice.organizationId,
            jobId: createJobRes.body.data._id,
            type: 'sourcing',
            status: 'queued',
        });

        // Warm Alice's tenant-specific Redis caches before Bob requests the same IDs.
        expect(
            await request(app)
                .get(`/api/jobs/${createJobRes.body.data._id}`)
                .set('Authorization', `Bearer ${alice.token}`)
        ).toMatchObject({ status: 200 });
        const aliceCandidateList = await request(app)
            .get(`/api/jobs/${createJobRes.body.data._id}/candidates`)
            .set('Authorization', `Bearer ${alice.token}`);
        expect(aliceCandidateList.body.data).toHaveLength(1);

        const bobJobs = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${bob.token}`);

        expect(bobJobs.status).toBe(200);
        expect(bobJobs.body.data.map((job: any) => job._id)).not.toContain(
            createJobRes.body.data._id
        );

        const bobReadAliceJob = await request(app)
            .get(`/api/jobs/${createJobRes.body.data._id}`)
            .set('Authorization', `Bearer ${bob.token}`);

        expect(bobReadAliceJob.status).toBe(404);

        const bobReadAliceCandidates = await request(app)
            .get(`/api/jobs/${createJobRes.body.data._id}/candidates`)
            .set('Authorization', `Bearer ${bob.token}`);
        expect(bobReadAliceCandidates.status).toBe(404);

        expect(
            await request(app)
                .get(`/api/tasks/${aliceTask._id}`)
                .set('Authorization', `Bearer ${alice.token}`)
        ).toMatchObject({ status: 200 });
        expect(
            await request(app)
                .get(`/api/tasks/${aliceTask._id}`)
                .set('Authorization', `Bearer ${bob.token}`)
        ).toMatchObject({ status: 404 });

        const [bobCandidates, bobInterviews, bobAnalytics, bobStats] = await Promise.all([
            request(app).get('/api/candidates').set('Authorization', `Bearer ${bob.token}`),
            request(app).get('/api/interviews').set('Authorization', `Bearer ${bob.token}`),
            request(app).get('/api/analytics').set('Authorization', `Bearer ${bob.token}`),
            request(app).get('/api/stats/global').set('Authorization', `Bearer ${bob.token}`),
        ]);
        expect(bobCandidates.body.data).toHaveLength(0);
        expect(bobInterviews.body.data).toHaveLength(0);
        expect(bobAnalytics.body.data.totals).toEqual({ jobs: 0, candidates: 0, interviews: 0 });
        expect(bobStats.body.data.totalCandidates).toBe(0);

        const saved = await Job.findById(createJobRes.body.data._id).lean();
        expect(saved?.organizationId?.toString()).toBe(alice.organizationId);
    });

    it('returns current organization memberships', async () => {
        const alice = await register(`org-list-${Date.now()}@example.com`);

        const res = await request(app)
            .get('/api/organizations')
            .set('Authorization', `Bearer ${alice.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.memberships).toHaveLength(1);
        expect(res.body.data.memberships[0].organization._id).toBe(alice.organizationId);
    });

    it('invites, accepts, disables members, and upgrades billing plan', async () => {
        const owner = await register(`owner-${Date.now()}@example.com`);
        const teammate = await register(`teammate-${Date.now()}@example.com`);

        const inviteRes = await request(app)
            .post('/api/organizations/current/invites')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ email: teammate.user.email, role: 'viewer' });

        expect(inviteRes.status).toBe(201);
        expect(inviteRes.body.data.inviteToken).toBeTruthy();
        expect(inviteRes.body.data.status).toBe('invited');

        const acceptRes = await request(app)
            .post('/api/organizations/invites/accept')
            .set('Authorization', `Bearer ${teammate.token}`)
            .send({ token: inviteRes.body.data.inviteToken });

        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.data.status).toBe('active');

        const switchRes = await request(app)
            .post('/api/auth/switch-workspace')
            .set('Authorization', `Bearer ${teammate.token}`)
            .send({ organizationId: owner.organizationId });
        expect(switchRes.status).toBe(200);
        expect(switchRes.body.data.user.defaultOrganizationId).toBe(owner.organizationId);
        const switchedJobs = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${switchRes.body.data.token}`);
        expect(switchedJobs.status).toBe(200);

        const membersRes = await request(app)
            .get('/api/organizations/current/members')
            .set('Authorization', `Bearer ${owner.token}`);

        expect(membersRes.status).toBe(200);
        expect(membersRes.body.data.length).toBeGreaterThanOrEqual(2);

        const teammateMembership = membersRes.body.data.find(
            (member: any) => member.user?.email === teammate.user.email
        );
        expect(teammateMembership).toBeTruthy();

        const disableRes = await request(app)
            .patch(`/api/organizations/current/members/${teammateMembership._id}`)
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ status: 'disabled' });

        expect(disableRes.status).toBe(200);
        expect(disableRes.body.data.status).toBe('disabled');

        const billingRes = await request(app)
            .post('/api/billing/checkout')
            .set('Authorization', `Bearer ${owner.token}`)
            .send({ plan: 'pro' });

        expect(billingRes.status).toBe(201);
        expect(billingRes.body.data.plan).toBe('pro');

        const billingStatusRes = await request(app)
            .get('/api/billing/status')
            .set('Authorization', `Bearer ${owner.token}`);

        expect(billingStatusRes.status).toBe(200);
        expect(billingStatusRes.body.data.plan).toBe('pro');
        expect(billingStatusRes.body.data.subscriptionStatus).toBe('active');
    });
});
