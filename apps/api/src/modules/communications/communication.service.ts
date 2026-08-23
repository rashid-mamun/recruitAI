import { Candidate } from '@/modules/candidates/candidate.model';
import { Job } from '@/modules/jobs/job.model';
import { NotFoundError, ValidationError } from '@/middleware/errorHandler';
import { sendTransactionalEmail } from '@/services/email.service';
import { CommunicationTemplate } from './communication-template.model';
import { EmailDelivery } from './email-delivery.model';
import { Interview } from '@/modules/interviews/interview.model';

export async function listTemplates(organizationId: string) {
    return CommunicationTemplate.find({ organizationId }).sort({ kind: 1, name: 1 }).lean();
}
export async function saveTemplate(organizationId: string, userId: string, dto: any, id?: string) {
    if (id) {
        const value = await CommunicationTemplate.findOneAndUpdate(
            { _id: id, organizationId },
            { $set: dto },
            { new: true, runValidators: true }
        ).lean();
        if (!value) throw new NotFoundError('Template');
        return value;
    }
    return (
        await CommunicationTemplate.create({ ...dto, organizationId, createdBy: userId })
    ).toJSON();
}
export async function deleteTemplate(organizationId: string, id: string) {
    const result = await CommunicationTemplate.deleteOne({ _id: id, organizationId });
    if (!result.deletedCount) throw new NotFoundError('Template');
}
export async function sendCandidateEmail(
    organizationId: string,
    userId: string,
    candidateId: string,
    dto: { templateId?: string; subject?: string; body?: string },
    interviewId?: string
) {
    const candidate = await Candidate.findOne({ _id: candidateId, organizationId }).lean();
    if (!candidate) throw new NotFoundError('Candidate');
    if (!candidate.email) throw new ValidationError('Candidate does not have an email address');
    const job = await Job.findOne({ _id: candidate.jobId, organizationId }).lean();
    if (!job) throw new NotFoundError('Job');
    const template = dto.templateId
        ? await CommunicationTemplate.findOne({ _id: dto.templateId, organizationId }).lean()
        : null;
    if (dto.templateId && !template) throw new NotFoundError('Template');
    const variables: Record<string, string> = {
        candidateName: candidate.name,
        jobTitle: job.title,
        companyName: 'RecruitAI',
    };
    const subject = render(template?.subject ?? dto.subject!, variables);
    const body = render(template?.body ?? dto.body!, variables);
    try {
        const sent = await sendTransactionalEmail({
            to: candidate.email,
            subject,
            html: textHtml(body),
            text: body,
        });
        const delivery = await EmailDelivery.create({
            organizationId,
            candidateId,
            jobId: candidate.jobId,
            interviewId: interviewId ?? null,
            templateId: template?._id ?? null,
            to: candidate.email,
            subject,
            body,
            status: sent.provider === 'smtp' ? 'sent' : 'preview',
            provider: sent.provider,
            providerMessageId: sent.messageId ?? null,
            sentBy: userId,
            sentAt: new Date(),
        });
        await Candidate.updateOne(
            { _id: candidateId, organizationId },
            { $set: { contactedAt: new Date(), status: 'contacted', lastActivityAt: new Date() } }
        );
        return delivery.toJSON();
    } catch (error) {
        const delivery = await EmailDelivery.create({
            organizationId,
            candidateId,
            jobId: candidate.jobId,
            interviewId: interviewId ?? null,
            templateId: template?._id ?? null,
            to: candidate.email,
            subject,
            body,
            status: 'failed',
            provider: 'smtp',
            error: error instanceof Error ? error.message : String(error),
            sentBy: userId,
        });
        return delivery.toJSON();
    }
}
export async function listDeliveries(organizationId: string, candidateId: string) {
    const exists = await Candidate.exists({ _id: candidateId, organizationId });
    if (!exists) throw new NotFoundError('Candidate');
    return EmailDelivery.find({ organizationId, candidateId }).sort({ createdAt: -1 }).lean();
}
export async function applyDeliveryEvent(providerMessageId: string, event: string, error?: string) {
    return EmailDelivery.findOneAndUpdate(
        { providerMessageId },
        {
            $set: {
                status: event,
                error: error ?? null,
                ...(event === 'delivered' ? { deliveredAt: new Date() } : {}),
                ...(event === 'replied' ? { repliedAt: new Date() } : {}),
            },
        },
        { new: true }
    ).lean();
}
export async function sendInterviewInvite(
    organizationId: string,
    userId: string,
    interviewId: string
) {
    const interview = await Interview.findOne({ _id: interviewId, organizationId }).lean();
    if (!interview) throw new NotFoundError('Interview');
    if (!interview.scheduledAt)
        throw new ValidationError('Schedule the interview before sending an invite');
    const [candidate, job] = await Promise.all([
        Candidate.findOne({ _id: interview.candidateId, organizationId }).lean(),
        Job.findOne({ _id: interview.jobId, organizationId }).lean(),
    ]);
    if (!candidate?.email) throw new ValidationError('Candidate does not have an email address');
    if (!job) throw new NotFoundError('Job');
    const start = new Date(interview.scheduledAt);
    const end = new Date(start.getTime() + (interview.durationMinutes || 60) * 60_000);
    const calendarEventUrl = googleCalendarUrl(
        interview.title,
        start,
        end,
        `${candidate.name} · ${job.title}`
    );
    const body = `Hello ${candidate.name},\n\nYour ${interview.title} for ${job.title} is scheduled for ${start.toISOString()}.\n\nAdd to Google Calendar: ${calendarEventUrl}`;
    const ics = calendarIcs(interview._id.toString(), interview.title, start, end, body);
    const sent = await sendTransactionalEmail({
        to: candidate.email,
        subject: `Interview invitation: ${job.title}`,
        html: textHtml(body),
        text: body,
        attachments: [{ filename: 'interview.ics', content: ics, contentType: 'text/calendar' }],
    });
    const delivery = await EmailDelivery.create({
        organizationId,
        candidateId: candidate._id,
        jobId: job._id,
        interviewId: interview._id,
        to: candidate.email,
        subject: `Interview invitation: ${job.title}`,
        body,
        status: sent.provider === 'smtp' ? 'sent' : 'preview',
        provider: sent.provider,
        providerMessageId: sent.messageId ?? null,
        sentBy: userId,
        sentAt: new Date(),
    });
    await Interview.updateOne(
        { _id: interviewId, organizationId },
        { $set: { status: 'scheduled', calendarEventUrl, inviteSentAt: new Date() } }
    );
    return { delivery: delivery.toJSON(), calendarEventUrl };
}
function render(value: string, variables: Record<string, string>) {
    return value.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => variables[key] ?? '');
}
function textHtml(value: string) {
    return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
}
function calendarStamp(value: Date) {
    return value
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
}
function googleCalendarUrl(title: string, start: Date, end: Date, details: string) {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
        details,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function calendarIcs(uid: string, title: string, start: Date, end: Date, description: string) {
    const clean = (value: string) => value.replace(/[\n,;]/g, match => `\\${match}`);
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//RecruitAI//Interview//EN',
        'BEGIN:VEVENT',
        `UID:${uid}@recruitai`,
        `DTSTAMP:${calendarStamp(new Date())}`,
        `DTSTART:${calendarStamp(start)}`,
        `DTEND:${calendarStamp(end)}`,
        `SUMMARY:${clean(title)}`,
        `DESCRIPTION:${clean(description)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}
