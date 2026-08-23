import mongoose from 'mongoose';
import { Job } from '@/modules/jobs/job.model';
import { Candidate } from '@/modules/candidates/candidate.model';
import { InterviewAnalysis } from '@/modules/interviews/interview-analysis.model';
import { NotFoundError, ValidationError } from '@/middleware/errorHandler';
import { JobScorecard } from './job-scorecard.model';
import { Evaluation } from './evaluation.model';
import type { UpsertScorecardDto } from './evaluation.schema';
import type {
    EvaluationCompetencyScore,
    IEvaluation,
    IJobScorecard,
    ScorecardCompetency,
} from '@/types';
import { organizationObjectId } from '@/utils/tenant';
import { ScorecardTemplate } from './scorecard-template.model';

export async function getOrCreateScorecard(
    jobId: string,
    organizationId: string
): Promise<IJobScorecard> {
    const existing = await JobScorecard.findOne({ jobId, organizationId }).lean();
    if (existing) return existing as unknown as IJobScorecard;

    const job = await Job.findOne({ _id: jobId, organizationId }).lean();
    if (!job) throw new NotFoundError('Job');

    const requirements = ((job as any).requirements ?? []) as string[];
    const competencies =
        requirements.length > 0
            ? requirements.slice(0, 8).map((requirement, index) => ({
                  id: slugify(requirement) || `competency-${index + 1}`,
                  name: requirement,
                  description: `Evidence that the candidate can satisfy: ${requirement}`,
                  weight: Math.max(10, Math.round(100 / Math.min(requirements.length, 8))),
              }))
            : [
                  {
                      id: 'role-fit',
                      name: 'Role fit',
                      description: 'Overall alignment with role requirements.',
                      weight: 40,
                  },
                  {
                      id: 'technical-depth',
                      name: 'Technical depth',
                      description: 'Depth of relevant technical experience.',
                      weight: 35,
                  },
                  {
                      id: 'communication',
                      name: 'Communication',
                      description: 'Clarity and quality of interview communication.',
                      weight: 25,
                  },
              ];

    return upsertScorecard(jobId, organizationId, {
        name: `${(job as any).title} Scorecard`,
        competencies: rebalanceWeights(competencies),
        passingScore: 70,
    });
}

export async function upsertScorecard(
    jobId: string,
    organizationId: string,
    dto: UpsertScorecardDto
): Promise<IJobScorecard> {
    const job = await Job.findOne({ _id: jobId, organizationId }).lean();
    if (!job) throw new NotFoundError('Job');

    const scorecard = await JobScorecard.findOneAndUpdate(
        { jobId, organizationId },
        {
            $set: {
                organizationId: organizationObjectId(organizationId),
                jobId: new mongoose.Types.ObjectId(jobId),
                name: dto.name,
                competencies: rebalanceWeights(dto.competencies),
                passingScore: dto.passingScore,
            },
        },
        { new: true, upsert: true, runValidators: true }
    ).lean();

    return scorecard as unknown as IJobScorecard;
}

export async function evaluateCandidate(
    jobId: string,
    candidateId: string,
    organizationId: string
): Promise<IEvaluation> {
    const [job, candidate, scorecard] = await Promise.all([
        Job.findOne({ _id: jobId, organizationId }).lean(),
        Candidate.findOne({ _id: candidateId, jobId, organizationId }).lean(),
        getOrCreateScorecard(jobId, organizationId),
    ]);

    if (!job) throw new NotFoundError('Job');
    if (!candidate) throw new NotFoundError('Candidate');

    const latestAnalysis = await InterviewAnalysis.findOne({
        jobId,
        candidateId,
        organizationId,
        status: 'completed',
    })
        .sort({ createdAt: -1 })
        .lean();

    const competencyScores = scorecard.competencies.map(competency =>
        scoreCompetency(competency, candidate, latestAnalysis)
    );

    const totalWeight = competencyScores.reduce((sum, item) => sum + item.weight, 0) || 1;
    const overallScore = Math.round(
        competencyScores.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight
    );

    const evaluation = await Evaluation.findOneAndUpdate(
        { jobId, candidateId, organizationId },
        {
            $set: {
                organizationId: organizationObjectId(organizationId),
                jobId: new mongoose.Types.ObjectId(jobId),
                candidateId: new mongoose.Types.ObjectId(candidateId),
                scorecardId: new mongoose.Types.ObjectId(scorecard._id),
                overallScore,
                recommendation: recommend(overallScore),
                competencyScores,
                summary: buildSummary(candidate, overallScore, latestAnalysis),
                source: latestAnalysis?.source === 'ai' ? 'ai' : 'fallback',
            },
        },
        { new: true, upsert: true, runValidators: true }
    ).lean();

    return evaluation as unknown as IEvaluation;
}

export async function listEvaluations(
    jobId: string,
    organizationId: string
): Promise<IEvaluation[]> {
    return (await Evaluation.find({ jobId, organizationId })
        .sort({ overallScore: -1 })
        .lean()) as unknown as IEvaluation[];
}

export async function compareCandidates(
    jobId: string,
    candidateIds: string[],
    organizationId: string
) {
    const [scorecard, candidates] = await Promise.all([
        getOrCreateScorecard(jobId, organizationId),
        Candidate.find({ _id: { $in: candidateIds }, jobId, organizationId }).lean(),
    ]);

    const evaluations = await Promise.all(
        candidates.map(candidate =>
            evaluateCandidate(jobId, candidate._id.toString(), organizationId)
        )
    );

    return {
        scorecard,
        candidates: candidates.map(candidate => {
            const evaluation = evaluations.find(
                item => item.candidateId.toString() === candidate._id.toString()
            );
            return {
                candidate,
                evaluation,
            };
        }),
    };
}

export async function listScorecardTemplates(organizationId: string) {
    return ScorecardTemplate.find({ organizationId }).sort({ roleFamily: 1, name: 1 }).lean();
}

export async function saveScorecardTemplate(
    organizationId: string,
    userId: string,
    dto: UpsertScorecardDto & { roleFamily: string },
    id?: string
) {
    const competencies = rebalanceWeights(dto.competencies);
    const values = {
        name: dto.name,
        roleFamily: dto.roleFamily,
        competencies,
        defaultWeights: Object.fromEntries(competencies.map(item => [item.id, item.weight])),
        passingScore: dto.passingScore,
    };
    if (id) {
        const template = await ScorecardTemplate.findOneAndUpdate(
            { _id: id, organizationId },
            { $set: values },
            { new: true, runValidators: true }
        ).lean();
        if (!template) throw new NotFoundError('Scorecard template');
        return template;
    }
    return (
        await ScorecardTemplate.create({ ...values, organizationId, createdBy: userId })
    ).toJSON();
}

export async function deleteScorecardTemplate(organizationId: string, id: string) {
    const result = await ScorecardTemplate.deleteOne({ _id: id, organizationId });
    if (!result.deletedCount) throw new NotFoundError('Scorecard template');
}

export async function applyScorecardTemplate(
    jobId: string,
    organizationId: string,
    templateId: string
) {
    const template = await ScorecardTemplate.findOne({ _id: templateId, organizationId }).lean();
    if (!template) throw new NotFoundError('Scorecard template');
    return upsertScorecard(jobId, organizationId, {
        name: template.name,
        competencies: template.competencies as any,
        passingScore: template.passingScore,
    });
}

export async function overrideEvaluation(
    evaluationId: string,
    organizationId: string,
    userId: string,
    dto: { competencyId: string; score: number; reason: string }
) {
    const evaluation = await Evaluation.findOne({ _id: evaluationId, organizationId });
    if (!evaluation) throw new NotFoundError('Evaluation');
    const competency = evaluation.competencyScores.find(
        item => item.competencyId === dto.competencyId
    );
    if (!competency) throw new ValidationError('Competency is not part of this evaluation');
    competency.humanOverrideScore = dto.score;
    competency.humanOverrideReason = dto.reason;
    const totalWeight =
        evaluation.competencyScores.reduce((sum, item) => sum + item.weight, 0) || 1;
    evaluation.overallScore = Math.round(
        evaluation.competencyScores.reduce(
            (sum, item) => sum + (item.humanOverrideScore ?? item.score) * item.weight,
            0
        ) / totalWeight
    );
    evaluation.recommendation = recommend(evaluation.overallScore);
    evaluation.reviewStatus = 'reviewed';
    evaluation.reviewedBy = userId;
    evaluation.reviewedAt = new Date();
    await evaluation.save();
    return evaluation.toJSON();
}

export async function reviewEvaluation(
    evaluationId: string,
    organizationId: string,
    userId: string
) {
    const evaluation = await Evaluation.findOneAndUpdate(
        { _id: evaluationId, organizationId },
        { $set: { reviewStatus: 'reviewed', reviewedBy: userId, reviewedAt: new Date() } },
        { new: true }
    ).lean();
    if (!evaluation) throw new NotFoundError('Evaluation');
    return evaluation;
}

function scoreCompetency(
    competency: ScorecardCompetency,
    candidate: any,
    analysis: any
): EvaluationCompetencyScore {
    const text = [
        candidate.headline,
        candidate.summary,
        candidate.experience,
        ...(candidate.skills ?? []),
        analysis?.executiveSummary,
        ...(analysis?.technicalSignals ?? []),
        ...(analysis?.behavioralSignals ?? []),
        ...(analysis?.communicationSignals ?? []),
    ]
        .join(' ')
        .toLowerCase();

    const words = `${competency.name} ${competency.description}`
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter(word => word.length > 2);

    const matches = words.filter(word => text.includes(word));
    let score = 45 + Math.min(matches.length * 8, 30);

    if (candidate.score?.value) {
        score = Math.round((score + candidate.score.value) / 2);
    }

    if (analysis?.recommendation === 'strong_yes') score += 10;
    if (analysis?.recommendation === 'yes') score += 6;
    if (analysis?.recommendation === 'no') score -= 12;
    if ((analysis?.riskFlags ?? []).length > 0)
        score -= Math.min(12, analysis.riskFlags.length * 4);

    const evidence = [
        ...(analysis?.evidence ?? []).map((item: any) => item.quote).filter(Boolean),
        ...(matches.length ? [`Matched evidence terms: ${matches.slice(0, 5).join(', ')}`] : []),
    ].slice(0, 4);

    const finalScore = clamp(Math.round(score), 0, 100);

    return {
        competencyId: competency.id,
        name: competency.name,
        score: finalScore,
        weight: competency.weight,
        rationale:
            matches.length > 0
                ? `Found ${matches.length} relevant signal(s) for ${competency.name}.`
                : `Limited direct evidence for ${competency.name}; review manually.`,
        evidence,
    };
}

function buildSummary(candidate: any, score: number, analysis: any): string {
    const name = candidate.name ?? 'Candidate';
    if (analysis?.executiveSummary) {
        return `${name} scored ${score}/100. ${analysis.executiveSummary}`;
    }
    return `${name} scored ${score}/100 using profile, scorecard, and available candidate evidence.`;
}

function recommend(score: number): IEvaluation['recommendation'] {
    if (score >= 88) return 'strong_yes';
    if (score >= 74) return 'yes';
    if (score >= 55) return 'maybe';
    return 'no';
}

function rebalanceWeights(competencies: ScorecardCompetency[]): ScorecardCompetency[] {
    const total = competencies.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
    return competencies.map(item => ({
        ...item,
        id: item.id || slugify(item.name),
        weight: Math.max(1, Math.round((item.weight / total) * 100)),
    }));
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 64);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
