import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Upload } from 'lucide-react';
import { downloadFileAsset, getFileAssets, uploadFileAsset } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

const ACCEPTED_RESUME_TYPES = '.pdf,.doc,.docx,.txt';

export default function CandidateResumePanel({ candidateId }: { candidateId: string }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    const { data: files = [], isLoading } = useQuery({
        queryKey: ['candidate-files', candidateId],
        queryFn: () => getFileAssets('candidate', candidateId),
        enabled: !!candidateId,
        staleTime: 20_000,
    });

    const resumes = files.filter((file) => file.kind === 'resume');

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const [contentBase64, extractedText] = await Promise.all([
                readAsBase64(file),
                file.type === 'text/plain' ? file.text() : Promise.resolve(''),
            ]);

            return uploadFileAsset({
                ownerType: 'candidate',
                ownerId: candidateId,
                kind: 'resume',
                filename: file.name,
                mimeType: file.type || inferMimeType(file.name),
                contentBase64,
                extractedText: extractedText.slice(0, 200000),
            });
        },
        onSuccess: () => {
            showSuccess(`resume-${candidateId}`, 'Resume uploaded.');
            queryClient.invalidateQueries({ queryKey: ['candidate-files', candidateId] });
            queryClient.invalidateQueries({ queryKey: ['candidate-details', candidateId] });
            if (inputRef.current) inputRef.current.value = '';
        },
        onError: (error: Error) => showError(`resume-${candidateId}`, error.message),
    });

    const downloadMutation = useMutation({
        mutationFn: async (file: { _id: string; filename: string }) => {
            const blob = await downloadFileAsset(file._id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        },
        onError: (error: Error) => showError(`resume-download-${candidateId}`, error.message),
    });

    return (
        <div className="card" style={{ padding: 20 }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} />
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Resume</div>
                </div>
                <button
                    className="btn btn--secondary btn--sm"
                    disabled={uploadMutation.isPending}
                    onClick={() => inputRef.current?.click()}
                >
                    {uploadMutation.isPending ? <div className="spinner" /> : <Upload size={13} />}
                    Upload
                </button>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_RESUME_TYPES}
                style={{ display: 'none' }}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                }}
            />

            {isLoading ? (
                <div className="text-sm text-muted">Loading resumes...</div>
            ) : resumes.length === 0 ? (
                <div className="text-sm text-muted">
                    Upload a resume to keep candidate evidence attached.
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                    {resumes.map((file) => (
                        <div
                            key={file._id}
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                padding: 10,
                                display: 'grid',
                                gap: 8,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: 13,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {file.filename}
                                </div>
                                <div className="text-sm text-muted">{formatBytes(file.size)}</div>
                                <div className="text-sm text-muted">
                                    Scan: {file.scanStatus ?? 'pending'}
                                </div>
                            </div>
                            <button
                                className="btn btn--primary btn--sm"
                                style={{ justifyContent: 'center' }}
                                disabled={downloadMutation.isPending}
                                onClick={() => downloadMutation.mutate(file)}
                            >
                                <Download size={13} /> Download
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    });
}

function inferMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
}

function formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
