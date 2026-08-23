import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageSquare, Plus, ShieldCheck } from 'lucide-react';
import {
    createComment,
    createReview,
    getAuditLogs,
    getComments,
    getReviews,
    updateReview,
} from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { CollaborationResourceType, Review } from '@/types';

export default function CollaborationPanel({
    resourceType,
    resourceId,
}: {
    resourceType: CollaborationResourceType;
    resourceId: string;
}) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [commentBody, setCommentBody] = useState('');
    const [reviewNote, setReviewNote] = useState('');

    const commentsQuery = useQuery({
        queryKey: ['comments', resourceType, resourceId],
        queryFn: () => getComments(resourceType, resourceId),
        enabled: !!resourceId,
    });

    const reviewsQuery = useQuery({
        queryKey: ['reviews', resourceType, resourceId],
        queryFn: () => getReviews(resourceType, resourceId),
        enabled: !!resourceId,
    });

    const auditQuery = useQuery({
        queryKey: ['audit-logs', resourceType, resourceId],
        queryFn: () => getAuditLogs({ resourceType, resourceId, limit: 8 }),
        enabled: !!resourceId,
        staleTime: 15_000,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['comments', resourceType, resourceId] });
        queryClient.invalidateQueries({ queryKey: ['reviews', resourceType, resourceId] });
        queryClient.invalidateQueries({ queryKey: ['audit-logs', resourceType, resourceId] });
    };

    const commentMutation = useMutation({
        mutationFn: () => createComment(resourceType, resourceId, commentBody.trim()),
        onSuccess: () => {
            setCommentBody('');
            showSuccess(`comment-${resourceId}`, 'Comment added.');
            invalidate();
        },
        onError: (error: Error) => showError(`comment-${resourceId}`, error.message),
    });

    const reviewMutation = useMutation({
        mutationFn: () => createReview(resourceType, resourceId, { note: reviewNote.trim() }),
        onSuccess: () => {
            setReviewNote('');
            showSuccess(`review-${resourceId}`, 'Review opened.');
            invalidate();
        },
        onError: (error: Error) => showError(`review-${resourceId}`, error.message),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: string; patch: Partial<Review> }) =>
            updateReview(id, patch),
        onSuccess: () => {
            showSuccess(`review-update-${resourceId}`, 'Review updated.');
            invalidate();
        },
        onError: (error: Error) => showError(`review-update-${resourceId}`, error.message),
    });

    const comments = commentsQuery.data ?? [];
    const reviews = reviewsQuery.data ?? [];
    const auditLogs = auditQuery.data ?? [];

    return (
        <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <MessageSquare size={16} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>Collaboration</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                <textarea
                    className="input"
                    rows={3}
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    placeholder="Add a team comment..."
                    style={{ resize: 'vertical', fontSize: 13 }}
                />
                <button
                    className="btn btn--secondary btn--sm"
                    disabled={!commentBody.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate()}
                >
                    {commentMutation.isPending ? <div className="spinner" /> : <Plus size={13} />}
                    Add Comment
                </button>

                {comments.length > 0 && (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {comments.slice(0, 3).map((comment) => (
                            <div
                                key={comment._id}
                                style={{
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 8,
                                    padding: 9,
                                    fontSize: 12,
                                }}
                            >
                                <div style={{ color: 'var(--color-text-muted)' }}>
                                    {new Date(comment.createdAt).toLocaleString()}
                                </div>
                                <div style={{ marginTop: 4 }}>{comment.body}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div
                    style={{
                        borderTop: '1px solid var(--color-border)',
                        paddingTop: 12,
                        marginTop: 4,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CheckCircle2 size={15} />
                        <strong style={{ fontSize: 13 }}>Review</strong>
                    </div>
                    <textarea
                        className="input"
                        rows={2}
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        placeholder="Open a review with a short note..."
                        style={{ resize: 'vertical', fontSize: 13 }}
                    />
                    <button
                        className="btn btn--secondary btn--sm"
                        style={{ marginTop: 8 }}
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate()}
                    >
                        {reviewMutation.isPending ? (
                            <div className="spinner" />
                        ) : (
                            <Plus size={13} />
                        )}
                        Open Review
                    </button>

                    {reviews.length > 0 && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {reviews.slice(0, 2).map((review) => (
                                <div
                                    key={review._id}
                                    style={{
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 8,
                                        padding: 9,
                                        fontSize: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                        }}
                                    >
                                        <strong style={{ textTransform: 'capitalize' }}>
                                            {review.status.replace('_', ' ')}
                                        </strong>
                                        {review.decision && (
                                            <span>{review.decision.replace('_', ' ')}</span>
                                        )}
                                    </div>
                                    {review.note && (
                                        <div
                                            style={{
                                                marginTop: 5,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {review.note}
                                        </div>
                                    )}
                                    {review.status === 'open' && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                            <button
                                                className="btn btn--primary btn--sm"
                                                onClick={() =>
                                                    updateMutation.mutate({
                                                        id: review._id,
                                                        patch: {
                                                            status: 'approved',
                                                            decision: 'yes',
                                                            note: review.note || 'Approved.',
                                                        },
                                                    })
                                                }
                                            >
                                                Approve
                                            </button>
                                            <button
                                                className="btn btn--secondary btn--sm"
                                                onClick={() =>
                                                    updateMutation.mutate({
                                                        id: review._id,
                                                        patch: {
                                                            status: 'changes_requested',
                                                            decision: 'maybe',
                                                            note:
                                                                review.note ||
                                                                'Needs more evidence before final decision.',
                                                        },
                                                    })
                                                }
                                            >
                                                Needs Work
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {auditLogs.length > 0 && (
                    <div
                        style={{
                            borderTop: '1px solid var(--color-border)',
                            paddingTop: 12,
                            marginTop: 4,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                            }}
                        >
                            <ShieldCheck size={15} />
                            <strong style={{ fontSize: 13 }}>Audit Trail</strong>
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                            {auditLogs.slice(0, 4).map((log) => (
                                <div
                                    key={log._id}
                                    style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
                                >
                                    {log.action} · {new Date(log.createdAt).toLocaleString()}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
