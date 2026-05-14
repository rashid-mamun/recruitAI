import mongoose from 'mongoose';
import { Task } from './task.model';
import { NotFoundError } from '@/middleware/errorHandler';
import { publishTaskUpdate } from '@/services/pubsub.service';
import type { ITask, TaskType } from '@/types';

export async function createTask(opts: {
    type: TaskType;
    jobId?: string;
    candidateId?: string;
}): Promise<ITask> {
    const task = await Task.create({
        type: opts.type,
        jobId: opts.jobId ? new mongoose.Types.ObjectId(opts.jobId) : undefined,
        candidateId: opts.candidateId ? new mongoose.Types.ObjectId(opts.candidateId) : undefined,
        status: 'queued',
        progress: 0,
    });
    return task.toJSON() as unknown as ITask;
}

export async function getTaskById(taskId: string): Promise<ITask> {
    const task = await Task.findById(taskId).lean();
    if (!task) throw new NotFoundError('Task');
    return task as unknown as ITask;
}

export async function updateTask(
    taskId: string,
    updates: Partial<
        Pick<
            ITask,
            'status' | 'progress' | 'result' | 'error' | 'bullJobId' | 'attempts' | 'completedAt'
        >
    >
): Promise<void> {
    const updatedTask = await Task.findByIdAndUpdate(
        taskId,
        { $set: updates },
        { new: true }
    ).lean();
    if (updatedTask) {
        // Publish to Redis instead of local SSE, so Express picks it up
        await publishTaskUpdate(taskId, updatedTask as unknown as ITask);
    }
}

export async function markProcessing(taskId: string, bullJobId: string): Promise<void> {
    await updateTask(taskId, { status: 'processing', progress: 0, bullJobId });
}

export async function markCompleted(
    taskId: string,
    result: Record<string, unknown>
): Promise<void> {
    await updateTask(taskId, {
        status: 'completed',
        progress: 100,
        result,
        completedAt: new Date(),
    });
}

export async function markFailed(taskId: string, error: string, attempts: number): Promise<void> {
    await updateTask(taskId, { status: 'failed', error, attempts });
}
