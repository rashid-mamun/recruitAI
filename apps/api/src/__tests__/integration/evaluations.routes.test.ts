import request from 'supertest';
import { createApp } from '@/app';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { InterviewAnalysis } from '@/modules/interviews/interview-analysis.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { JobScorecard } from '@/modules/evaluations/job-scorecard.model';

const app = createApp();

describe('Evaluations Routes (Structured Hiring Flow)', () => {
    let token: string;
    let organizationId: string;
    let jobId: string;
    let candidateOneId: string;
    let candidateTwoId: string;

    beforeEach(async () => {
        const authRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Evaluation Tester',
                email: `evaluation-${Date.now()}@example.com`,
                password: 'Password123!',
                role: 'recruiter',
            });
        token = authRes.body.data.token;
        organizationId = authRes.body.data.user.defaultOrganizationId;

        const job = await Job.create({
            organizationId,
            title: 'Product Engineer',
            description:
                'Build customer-facing features with strong architecture and collaboration.',
            location: 'Remote',
            requirements: ['React', 'Node.js', 'Architecture', 'Communication'],
        });
        jobId = job._id.toString();

        const candidateOne = await Candidate.create({
            organizationId,
            jobId,
            name: 'Asha Khan',
            linkedinUrl: 'https://linkedin.com/in/asha-khan',
            headline: 'Product Engineer focused on React and Node.js',
            summary: 'Led architecture work and communicated technical decisions.',
            skills: ['React', 'Node.js', 'Architecture'],
            experience: '7 years',
            location: 'Remote',
            source: 'manual',
            status: 'scored',
            score: {
                value: 86,
                reasoning: 'Strong profile match.',
                strengths: ['React', 'Node.js'],
                weaknesses: [],
                cachedAt: new Date(),
                source: 'ai',
            },
        });
        candidateOneId = candidateOne._id.toString();

        const candidateTwo = await Candidate.create({
            organizationId,
            jobId,
            name: 'Rafi Ahmed',
            linkedinUrl: 'https://linkedin.com/in/rafi-ahmed',
            headline: 'Backend Engineer',
            summary: 'Mostly backend platform experience.',
            skills: ['Node.js', 'MongoDB'],
            experience: '4 years',
            location: 'Remote',
            source: 'manual',
            status: 'scored',
            score: {
                value: 62,
                reasoning: 'Some alignment.',
                strengths: ['Node.js'],
                weaknesses: ['React'],
                cachedAt: new Date(),
                source: 'fallback',
            },
        });
        candidateTwoId = candidateTwo._id.toString();

        await InterviewAnalysis.create({
            organizationId,
            interviewId: candidateOne._id,
            candidateId: candidateOne._id,
            jobId,
            status: 'completed',
            executiveSummary:
                'Candidate gave clear examples of React delivery, architecture ownership, and communication with stakeholders.',
            technicalSignals: ['Strong React delivery', 'Architecture ownership'],
            behavioralSignals: ['Collaborated with product and design'],
            communicationSignals: ['Clear structured answers'],
            riskFlags: [],
            evidence: [
                {
                    label: 'Architecture',
                    quote: 'I owned the architecture tradeoffs and explained them to the team.',
                },
            ],
            recommendation: 'yes',
            confidence: 0.78,
            aiModel: 'test-model',
            source: 'ai',
        });
    });

    it('creates default scorecard, upserts custom scorecard, evaluates, and compares candidates', async () => {
        const defaultRes = await request(app)
            .get(`/api/jobs/${jobId}/scorecard`)
            .set('Authorization', `Bearer ${token}`);

        expect(defaultRes.status).toBe(200);
        expect(defaultRes.body.success).toBe(true);
        expect(defaultRes.body.data.competencies).toHaveLength(4);
        expect(defaultRes.body.data.competencies[0]).toHaveProperty('weight');

        const customRes = await request(app)
            .put(`/api/jobs/${jobId}/scorecard`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Product Engineer Scorecard',
                passingScore: 72,
                competencies: [
                    {
                        id: 'frontend',
                        name: 'Frontend depth',
                        description: 'React product delivery and UI engineering.',
                        weight: 35,
                    },
                    {
                        id: 'backend',
                        name: 'Backend depth',
                        description: 'Node.js API and service experience.',
                        weight: 30,
                    },
                    {
                        id: 'architecture',
                        name: 'Architecture',
                        description: 'System design, tradeoffs, and ownership.',
                        weight: 20,
                    },
                    {
                        id: 'communication',
                        name: 'Communication',
                        description: 'Clear interview answers and stakeholder communication.',
                        weight: 15,
                    },
                ],
            });

        expect(customRes.status).toBe(200);
        expect(customRes.body.data.name).toBe('Product Engineer Scorecard');
        expect(customRes.body.data.competencies).toHaveLength(4);

        const evaluateRes = await request(app)
            .post(`/api/jobs/${jobId}/evaluations`)
            .set('Authorization', `Bearer ${token}`)
            .send({ candidateId: candidateOneId });

        expect(evaluateRes.status).toBe(201);
        expect(evaluateRes.body.success).toBe(true);
        expect(evaluateRes.body.data.overallScore).toBeGreaterThanOrEqual(60);
        expect(evaluateRes.body.data.competencyScores).toHaveLength(4);
        expect(evaluateRes.body.data.summary).toContain('Asha Khan');

        const savedEvaluation = await Evaluation.findOne({ jobId, candidateId: candidateOneId });
        expect(savedEvaluation?.overallScore).toBe(evaluateRes.body.data.overallScore);

        const listRes = await request(app)
            .get(`/api/jobs/${jobId}/evaluations`)
            .set('Authorization', `Bearer ${token}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data).toHaveLength(1);

        const compareRes = await request(app)
            .get(`/api/jobs/${jobId}/compare?candidateIds=${candidateOneId},${candidateTwoId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(compareRes.status).toBe(200);
        expect(compareRes.body.data.scorecard.name).toBe('Product Engineer Scorecard');
        expect(compareRes.body.data.candidates).toHaveLength(2);
        expect(compareRes.body.data.candidates[0].evaluation).toHaveProperty('overallScore');

        const scorecardCount = await JobScorecard.countDocuments({ jobId });
        expect(scorecardCount).toBe(1);
    });

    it('rejects invalid scorecard payloads', async () => {
        const res = await request(app)
            .put(`/api/jobs/${jobId}/scorecard`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Broken scorecard',
                competencies: [],
            });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            code: 'VALIDATION_ERROR',
        });
    });
});
