import mongoose from 'mongoose';
import { env } from '@/config/env';
import { User } from '@/modules/auth/user.model';
import { Organization } from '@/modules/organizations/organization.model';
import { Membership } from '@/modules/organizations/membership.model';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { Interview } from '@/modules/interviews/interview.model';
import { TranscriptSegment } from '@/modules/interviews/transcript-segment.model';
import { InterviewAnalysis } from '@/modules/interviews/interview-analysis.model';
import { JobScorecard } from '@/modules/evaluations/job-scorecard.model';
import { Evaluation } from '@/modules/evaluations/evaluation.model';
import { HiringDecision } from '@/modules/decisions/hiring-decision.model';
import { Comment } from '@/modules/collaboration/comment.model';
import { Notification } from '@/modules/notifications/notification.model';
import { Message } from '@/modules/candidates/message.model';

const seedEmail = (process.env.SEED_USER_EMAIL || 'demo@recruitai.local').toLowerCase();
const seedPassword = process.env.SEED_USER_PASSWORD || 'Demo1234!';
const marker = 'recruitai-realistic-seed-v1';

const jobs = [
    {
        title: 'Senior Backend Engineer',
        location: 'Dhaka · Hybrid',
        type: 'full-time',
        status: 'active',
        requirements: ['Node.js', 'TypeScript', 'MongoDB', 'System design'],
        description: 'Own high-throughput recruiting services and mentor backend engineers.',
    },
    {
        title: 'Product Designer',
        location: 'Remote · Bangladesh',
        type: 'full-time',
        status: 'active',
        requirements: ['Figma', 'Design systems', 'User research', 'Prototyping'],
        description: 'Design clear recruiter and candidate experiences across the hiring platform.',
    },
    {
        title: 'AI/ML Engineer',
        location: 'Dhaka · Hybrid',
        type: 'full-time',
        status: 'active',
        requirements: ['Python', 'LLMs', 'RAG', 'Evaluation'],
        description: 'Build reliable interview intelligence and evidence extraction pipelines.',
    },
    {
        title: 'Customer Success Manager',
        location: 'Remote · APAC',
        type: 'full-time',
        status: 'paused',
        requirements: ['B2B SaaS', 'Onboarding', 'Analytics', 'Communication'],
        description: 'Help growing teams adopt structured, evidence-based hiring workflows.',
    },
] as const;

const people = [
    [
        'Nusrat Jahan',
        'Senior Software Engineer',
        'Pathao',
        92,
        'interested',
        ['Node.js', 'TypeScript', 'AWS', 'MongoDB'],
    ],
    [
        'Tanvir Hasan',
        'Backend Engineer',
        'ShopUp',
        84,
        'scheduling',
        ['Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    ],
    [
        'Ayesha Rahman',
        'Platform Engineer',
        'bKash',
        78,
        'contacted',
        ['Go', 'Kubernetes', 'AWS', 'System design'],
    ],
    [
        'Mahmudul Karim',
        'Software Engineer',
        'Brain Station 23',
        67,
        'scored',
        ['Java', 'Spring', 'Kafka', 'SQL'],
    ],
    [
        'Farzana Islam',
        'Product Designer',
        'Chaldal',
        89,
        'interested',
        ['Figma', 'Research', 'Design systems', 'Prototyping'],
    ],
    [
        'Sadia Ahmed',
        'UX Designer',
        'Nagad',
        81,
        'responded',
        ['Figma', 'Usability testing', 'Mobile UX', 'Accessibility'],
    ],
    [
        'Rafiul Alam',
        'Senior Product Designer',
        'Remote',
        74,
        'contacted',
        ['Figma', 'B2B SaaS', 'Workshops', 'Analytics'],
    ],
    [
        'Mehedi Hossain',
        'ML Engineer',
        'TigerIT',
        94,
        'scheduling',
        ['Python', 'PyTorch', 'LLMs', 'RAG'],
    ],
    [
        'Tasnim Akter',
        'Data Scientist',
        'Robi',
        86,
        'interested',
        ['Python', 'NLP', 'Evaluation', 'MLOps'],
    ],
    [
        'Sakib Khan',
        'AI Engineer',
        'BJIT',
        76,
        'scored',
        ['Python', 'LangChain', 'Vector DB', 'FastAPI'],
    ],
    [
        'Fahim Chowdhury',
        'Customer Success Lead',
        'Paperfly',
        88,
        'hired',
        ['B2B SaaS', 'Onboarding', 'CRM', 'Analytics'],
    ],
    [
        'Jannatul Ferdous',
        'Account Manager',
        'Foodpanda',
        79,
        'responded',
        ['Customer success', 'Retention', 'Communication', 'Reporting'],
    ],
] as const;

async function main() {
    if (env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        throw new Error(
            'Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true explicitly.'
        );
    }
    await mongoose.connect(env.MONGODB_URI);

    let user = await User.findOne({ email: seedEmail });
    let createdUser = false;
    if (!user) {
        user = await User.create({
            name: 'RecruitAI Demo Recruiter',
            email: seedEmail,
            password: seedPassword,
            role: 'recruiter',
            emailVerified: true,
        });
        createdUser = true;
    }

    let organization = user.defaultOrganizationId
        ? await Organization.findById(user.defaultOrganizationId)
        : null;
    if (!organization) {
        organization = await Organization.create({
            name: 'Northstar Talent Lab',
            slug: `northstar-talent-${Date.now()}`,
            plan: 'pro',
            status: 'active',
            settings: { seedMarker: marker },
        });
        await Membership.create({
            organizationId: organization._id,
            userId: user._id,
            role: 'owner',
            status: 'active',
        });
        user.defaultOrganizationId = organization._id as any;
        await user.save();
    }

    const organizationId = organization._id;
    const oldSeedJobs = await Job.find({ organizationId, sourcingQueries: marker })
        .select('_id')
        .lean();
    const oldJobIds = oldSeedJobs.map(item => item._id);
    const oldCandidates = await Candidate.find({ organizationId, jobId: { $in: oldJobIds } })
        .select('_id')
        .lean();
    const oldCandidateIds = oldCandidates.map(item => item._id);
    const oldInterviews = await Interview.find({ organizationId, jobId: { $in: oldJobIds } })
        .select('_id')
        .lean();
    const oldInterviewIds = oldInterviews.map(item => item._id);
    await Promise.all([
        TranscriptSegment.deleteMany({ interviewId: { $in: oldInterviewIds } }),
        InterviewAnalysis.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
        Evaluation.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
        JobScorecard.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
        HiringDecision.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
        Message.deleteMany({ jobId: { $in: oldJobIds } }),
        Comment.deleteMany({ organizationId, resourceId: { $in: oldCandidateIds } }),
        Notification.deleteMany({ organizationId, message: /^Demo:/ }),
        Interview.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
        Candidate.deleteMany({ organizationId, jobId: { $in: oldJobIds } }),
    ]);
    await Job.deleteMany({ organizationId, sourcingQueries: marker });

    let candidateCursor = 0;
    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex += 1) {
        const definition = jobs[jobIndex];
        const job = await Job.create({
            ...definition,
            organizationId,
            sourcingQueries: [marker, `${definition.title} Bangladesh`],
        });
        const competencies = definition.requirements.map((name, index) => ({
            id: `competency-${index + 1}`,
            name,
            description: `Practical evidence of ${name}`,
            weight: 25,
        }));
        const scorecard = await JobScorecard.create({
            organizationId,
            jobId: job._id,
            name: `${definition.title} scorecard`,
            competencies,
            passingScore: 72,
        });

        for (let offset = 0; offset < 3; offset += 1) {
            const [name, title, company, score, status, skills] = people[candidateCursor++];
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const now = Date.now() - candidateCursor * 7 * 60 * 60 * 1000;
            const candidate = await Candidate.create({
                organizationId,
                jobId: job._id,
                name,
                email: `${slug}@example.com`,
                phone: `+88017${String(10000000 + candidateCursor).slice(-8)}`,
                currentCompany: company,
                currentTitle: title,
                linkedinUrl: `https://linkedin.com/in/${slug}-demo`,
                headline: `${title} at ${company}`,
                summary: `${name} has demonstrated ownership, clear communication, and measurable delivery in fast-moving teams.`,
                skills,
                experience: `${5 + (candidateCursor % 5)} years of relevant experience`,
                location:
                    candidateCursor % 3 === 0 ? 'Chattogram, Bangladesh' : 'Dhaka, Bangladesh',
                source: candidateCursor % 2 ? 'LinkedIn' : 'Referral',
                sourceDetails: { seedMarker: marker, campaign: 'Bangladesh talent network' },
                status,
                starred: score >= 88,
                tags: score >= 85 ? ['top-talent', 'priority'] : ['review'],
                notes:
                    score >= 85
                        ? 'Strong evidence across core requirements. Prioritize next step.'
                        : 'Validate depth in the next structured interview.',
                consentStatus: 'granted',
                privacyRegion: 'BD',
                ownerUserId: user._id.toString(),
                assignedRecruiterIds: [user._id.toString()],
                lastActivityAt: new Date(now),
                score: {
                    value: score,
                    reasoning: `Strong match for ${definition.title}; scored against role requirements.`,
                    strengths: skills.slice(0, 3),
                    weaknesses:
                        score < 80
                            ? ['Needs deeper evidence in one core competency']
                            : ['Compensation expectations need confirmation'],
                    cachedAt: new Date(now),
                    source: 'ai',
                },
                scoredAt: new Date(now),
                contactedAt: [
                    'contacted',
                    'responded',
                    'interested',
                    'scheduling',
                    'hired',
                ].includes(status)
                    ? new Date(now + 3600000)
                    : null,
                respondedAt: ['responded', 'interested', 'scheduling', 'hired'].includes(status)
                    ? new Date(now + 7200000)
                    : null,
                hiredAt: status === 'hired' ? new Date(now + 10800000) : null,
            });

            const competencyScores = competencies.map((competency, index) => ({
                competencyId: competency.id,
                name: competency.name,
                score: Math.max(55, Math.min(98, score + index * 2 - 3)),
                weight: competency.weight,
                rationale: `${name} provided credible ${competency.name} evidence.`,
                evidence: [`Delivered measurable outcomes using ${competency.name}.`],
            }));
            const evaluation = await Evaluation.create({
                organizationId,
                jobId: job._id,
                candidateId: candidate._id,
                scorecardId: scorecard._id,
                overallScore: score,
                recommendation:
                    score >= 90 ? 'strong_yes' : score >= 80 ? 'yes' : score >= 70 ? 'maybe' : 'no',
                competencyScores,
                summary: `Structured evaluation for ${name}.`,
                source: 'ai',
                reviewStatus: score >= 85 ? 'reviewed' : 'pending',
                reviewedBy: score >= 85 ? user._id.toString() : null,
                reviewedAt: score >= 85 ? new Date() : null,
            });

            if (offset < 2) {
                const transcript = `Interviewer: Tell me about a difficult project you owned.\nCandidate: I led a cross-functional delivery, clarified the risks, and improved the key metric by ${18 + candidateCursor} percent.\nInterviewer: How did you handle disagreement?\nCandidate: I documented tradeoffs, invited feedback, and aligned the team around measurable outcomes.`;
                const interview = await Interview.create({
                    organizationId,
                    jobId: job._id,
                    candidateId: candidate._id,
                    title:
                        offset === 0
                            ? 'Hiring manager interview'
                            : 'Structured competency interview',
                    round: offset === 0 ? 'Round 1' : 'Round 2',
                    type: offset === 0 ? 'behavioral' : 'technical',
                    status: 'analysis_ready',
                    scheduledAt: new Date(now - 86400000),
                    durationMinutes: 45,
                    interviewerNames: ['Sarah Khan'],
                    interviewerIds: [user._id.toString()],
                    notes: 'Candidate was prepared and answered with specific examples.',
                    transcriptText: transcript,
                });
                const segments = await TranscriptSegment.insertMany([
                    {
                        interviewId: interview._id,
                        speaker: 'Interviewer',
                        speakerRole: 'interviewer',
                        startTime: 0,
                        endTime: 8,
                        text: 'Tell me about a difficult project you owned.',
                        confidence: 0.99,
                    },
                    {
                        interviewId: interview._id,
                        speaker: 'Candidate',
                        speakerRole: 'candidate',
                        startTime: 9,
                        endTime: 37,
                        text: `I led a cross-functional delivery and improved the key metric by ${18 + candidateCursor} percent.`,
                        confidence: 0.96,
                    },
                ]);
                const analysis = await InterviewAnalysis.create({
                    organizationId,
                    interviewId: interview._id,
                    candidateId: candidate._id,
                    jobId: job._id,
                    status: 'completed',
                    executiveSummary: `${name} demonstrated ownership, structured thinking, and strong stakeholder communication.`,
                    technicalSignals: skills.slice(0, 2),
                    behavioralSignals: ['Takes ownership', 'Uses measurable outcomes'],
                    communicationSignals: [
                        'Concise, structured examples',
                        'Explains tradeoffs clearly',
                    ],
                    riskFlags: score < 80 ? ['Depth requires validation'] : [],
                    evidence: [
                        {
                            label: 'Ownership',
                            quote: segments[1].text,
                            speaker: 'Candidate',
                            segmentId: segments[1]._id,
                        },
                    ],
                    recommendation: score >= 90 ? 'strong_yes' : score >= 80 ? 'yes' : 'maybe',
                    confidence: 0.88,
                    aiModel: 'demo-evidence-model',
                    source: 'ai',
                });
                interview.analysisId = analysis._id as any;
                await interview.save();
            }

            if (score >= 84 || status === 'hired')
                await HiringDecision.create({
                    organizationId,
                    jobId: job._id,
                    candidateId: candidate._id,
                    decision: status === 'hired' ? 'hired' : score >= 90 ? 'offer' : 'shortlist',
                    reason: `Evidence and scorecard results support progressing ${name}.`,
                    decidedBy: user._id.toString(),
                    approvedBy: status === 'hired' ? user._id.toString() : null,
                });
            await Comment.create({
                organizationId,
                resourceType: 'candidate',
                resourceId: candidate._id,
                body:
                    score >= 85
                        ? 'Strong candidate—please review the interview evidence before the debrief.'
                        : 'Add one more competency-focused screen.',
                visibility: 'team',
                createdBy: user._id.toString(),
                createdByName: user.name,
            });
            if (candidate.contactedAt) {
                const message = await Message.create({
                    candidateId: candidate._id,
                    jobId: job._id,
                    content: `Hi ${name.split(' ')[0]}, your background looks relevant to our ${definition.title} role. Would you be open to a conversation?`,
                    role: 'ai',
                    channel: 'email',
                    source: 'ai',
                    status: candidate.respondedAt ? 'replied' : 'sent',
                    sentAt: candidate.contactedAt,
                    repliedAt: candidate.respondedAt,
                });
                candidate.outreachMessages.push(message._id as any);
                await candidate.save();
                if (candidate.respondedAt)
                    await Message.create({
                        candidateId: candidate._id,
                        jobId: job._id,
                        content:
                            'Thanks for reaching out. I am interested and would be happy to discuss the role.',
                        role: 'candidate',
                        channel: 'email',
                        source: 'ai',
                        status: 'replied',
                        intent: 'interested',
                        intentConfidence: 0.94,
                        repliedAt: candidate.respondedAt,
                    });
            }
        }
    }

    await Notification.insertMany([
        {
            organizationId,
            recipientUserId: user._id.toString(),
            type: 'analysis_ready',
            message: 'Demo: Mehedi Hossain’s interview analysis is ready.',
            link: '/interviews',
        },
        {
            organizationId,
            recipientUserId: user._id.toString(),
            type: 'decision_changed',
            message: 'Demo: Nusrat Jahan moved to offer review.',
            link: '/candidates',
        },
    ]);

    console.log('\nRealistic seed complete');
    console.log(`Workspace: ${organization.name}`);
    console.log(`Login: ${seedEmail}`);
    if (createdUser) console.log(`Password: ${seedPassword}`);
    console.log(
        'Created: 4 jobs, 12 candidates, 8 interviews, scorecards, evaluations, decisions, messages, comments and notifications.'
    );
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => mongoose.disconnect());
