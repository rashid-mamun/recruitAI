import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { TranscriptSegment } from '@/modules/interviews/transcript-segment.model';
import { interviewAnalysisQueue } from '@/queues';

const app = createApp();

describe('Interviews Routes (End-to-End Integration)', () => {
    let token: string;
    let organizationId: string;
    let jobId: string;
    let candidateId: string;

    beforeEach(async () => {
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Interview Tester',
                email: `interview-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        token = authRes.body.data.token;
        organizationId = authRes.body.data.user.defaultOrganizationId;

        const job = await Job.create({
            organizationId,
            title: 'Senior Full Stack Engineer',
            description: 'Build reliable product features with Node.js, React, and MongoDB.',
            location: 'Remote',
            requirements: ['Node.js', 'React', 'MongoDB', 'System design'],
        });
        jobId = job._id.toString();

        const candidate = await Candidate.create({
            organizationId,
            jobId,
            name: 'Nadia Rahman',
            email: 'nadia@example.com',
            linkedinUrl: 'https://linkedin.com/in/nadia-rahman',
            headline: 'Senior Full Stack Engineer',
            summary: 'Owns full-stack product delivery.',
            skills: ['Node.js', 'React', 'MongoDB'],
            experience: '6 years',
            location: 'Remote',
            source: 'manual',
            status: 'sourced',
        });
        candidateId = candidate._id.toString();
    });

    it('create interview -> save transcript -> get parsed transcript -> queue analysis', async () => {
        const transcript = [
            'Interviewer: Tell me about a system you designed.',
            'Candidate: I designed a Node.js API with MongoDB and Redis for queue-backed workflows.',
            'Interviewer: How did you work with the team?',
            'Candidate: I owned delivery, mentored two engineers, and coordinated tradeoffs.',
        ].join('\n');

        const createRes = await request(app)
            .post('/api/interviews')
            .set('Authorization', `Bearer ${token}`)
            .send({
                jobId,
                candidateId,
                title: 'Technical Interview',
                round: 'Round 1',
                type: 'technical',
                transcriptText: transcript,
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.success).toBe(true);
        expect(createRes.body.data).toMatchObject({
            title: 'Technical Interview',
            status: 'completed',
            candidateId,
            jobId,
        });

        const interviewId = createRes.body.data._id;

        const savedInterview = await Interview.findById(interviewId).lean();
        expect(savedInterview?.transcriptText).toContain('Node.js API');

        const savedSegments = await TranscriptSegment.find({ interviewId }).lean();
        expect(savedSegments).toHaveLength(4);
        expect(savedSegments[0]).toMatchObject({
            speaker: 'Interviewer',
            speakerRole: 'interviewer',
        });
        expect(savedSegments[1]).toMatchObject({
            speaker: 'Candidate',
            speakerRole: 'candidate',
        });

        const replacementTranscript = [
            'Interviewer: What was the toughest technical decision?',
            'Candidate: We moved from synchronous processing to BullMQ workers for reliability.',
            'Interviewer: What would you improve?',
            'Candidate: I would add stronger observability and tracing from day one.',
        ].join('\n');

        const transcriptRes = await request(app)
            .post(`/api/interviews/${interviewId}/transcript`)
            .set('Authorization', `Bearer ${token}`)
            .send({ transcriptText: replacementTranscript });

        expect(transcriptRes.status).toBe(200);
        expect(transcriptRes.body.success).toBe(true);
        expect(transcriptRes.body.data.transcriptSegments).toHaveLength(4);
        expect(transcriptRes.body.data.transcriptSegments[1].text).toContain('BullMQ workers');

        const detailsRes = await request(app)
            .get(`/api/interviews/${interviewId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(detailsRes.status).toBe(200);
        expect(detailsRes.body.data.interview._id).toBe(interviewId);
        expect(detailsRes.body.data.transcriptSegments).toHaveLength(4);
        expect(detailsRes.body.data.analysis).toBeNull();

        const analyzeRes = await request(app)
            .post(`/api/interviews/${interviewId}/analyze`)
            .set('Authorization', `Bearer ${token}`)
            .send();

        expect(analyzeRes.status).toBe(202);
        expect(analyzeRes.body).toMatchObject({
            success: true,
            data: { status: 'queued' },
        });
        expect(analyzeRes.body.data.taskId).toEqual(expect.any(String));
        expect(interviewAnalysisQueue.add).toHaveBeenCalledWith(
            'analyze-interview',
            expect.objectContaining({ interviewId, candidateId, jobId }),
            expect.any(Object)
        );

        const analyzingInterview = await Interview.findById(interviewId).lean();
        expect(analyzingInterview?.status).toBe('analyzing');
    });

    it('rejects unauthenticated interview access', async () => {
        const res = await request(app).get('/api/interviews');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('validates required fields when creating an interview', async () => {
        const res = await request(app)
            .post('/api/interviews')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Missing references' });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            code: 'VALIDATION_ERROR',
        });
    });
});
