import request from 'supertest';
import { createApp } from '@/app';
import { User } from '@/modules/auth/user.model';
import { Membership } from '@/modules/organizations/membership.model';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { createNotification } from '@/modules/notifications/notification.service';

const app = createApp();

async function register(name: string) {
    const email = `${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`;
    const response = await request(app)
        .post('/api/auth/register')
        .send({ name, email, password: 'Password123!', role: 'recruiter' });
    return {
        email,
        token: response.body.data.token,
        userId: response.body.data.user.id,
        organizationId: response.body.data.user.defaultOrganizationId,
    };
}

async function moveToWorkspace(
    account: Awaited<ReturnType<typeof register>>,
    organizationId: string,
    role: 'viewer' | 'interviewer'
) {
    await Membership.create({ organizationId, userId: account.userId, role, status: 'active' });
    await User.updateOne(
        { _id: account.userId },
        { $set: { defaultOrganizationId: organizationId } }
    );
    const login = await request(app)
        .post('/api/auth/login')
        .send({ email: account.email, password: 'Password123!' });
    return login.body.data.token as string;
}

describe('Workspace role permissions and persistent notifications', () => {
    it('enforces viewer read-only and assigned interviewer access', async () => {
        const owner = await register('Role Owner');
        const viewer = await register('Role Viewer');
        const interviewer = await register('Role Interviewer');
        const viewerToken = await moveToWorkspace(viewer, owner.organizationId, 'viewer');
        const interviewerToken = await moveToWorkspace(
            interviewer,
            owner.organizationId,
            'interviewer'
        );
        const job = await Job.create({
            organizationId: owner.organizationId,
            title: 'QA Engineer',
            description: 'Test systems',
            location: 'Remote',
            requirements: ['Testing'],
        });
        const candidate = await Candidate.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            name: 'Raisa Ahmed',
            linkedinUrl: 'https://linkedin.com/in/raisa-role',
            source: 'manual',
        });
        await Interview.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            candidateId: candidate._id,
            title: 'Assigned interview',
            interviewerIds: [interviewer.userId],
        });
        await Interview.create({
            organizationId: owner.organizationId,
            jobId: job._id,
            candidateId: candidate._id,
            title: 'Private interview',
            interviewerIds: [],
        });

        const viewerRead = await request(app)
            .get('/api/jobs')
            .set('Authorization', `Bearer ${viewerToken}`);
        expect(viewerRead.status).toBe(200);
        const viewerWrite = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${viewerToken}`)
            .send({ title: 'Forbidden', description: 'No', location: 'Remote', requirements: [] });
        expect(viewerWrite.status).toBe(403);

        const assignedList = await request(app)
            .get('/api/interviews')
            .set('Authorization', `Bearer ${interviewerToken}`);
        expect(assignedList.status).toBe(200);
        expect(assignedList.body.data).toHaveLength(1);
        expect(assignedList.body.data[0].title).toBe('Assigned interview');
    });

    it('persists recipient notifications and read state', async () => {
        const owner = await register('Notification Owner');
        await createNotification({
            organizationId: owner.organizationId,
            recipientUserId: owner.userId,
            type: 'analysis_ready',
            message: 'Analysis ready',
            link: '/interviews/example',
        });
        const list = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(list.status).toBe(200);
        expect(list.body.data).toHaveLength(1);
        expect(list.body.data[0].read).toBe(false);
        const read = await request(app)
            .patch(`/api/notifications/${list.body.data[0]._id}/read`)
            .set('Authorization', `Bearer ${owner.token}`);
        expect(read.status).toBe(200);
        const refreshed = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${owner.token}`);
        expect(refreshed.body.data[0].read).toBe(true);
    });
});
