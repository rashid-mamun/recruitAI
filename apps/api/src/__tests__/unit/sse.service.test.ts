import { sse } from '@/services/sse.service';
import { Response } from 'express';

describe('SSE Service', () => {
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockRes = {
            write: jest.fn(),
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
        };
    });

    it('client connects -> added to client registry', () => {
        const taskId = 'task-1';
        sse.addClient(taskId, mockRes as Response);

        // We can test this indirectly by broadcasting and seeing if it gets written
        sse.broadcastToTask(taskId, 'test-event', { status: 'queued' });

        expect(mockRes.write).toHaveBeenCalled();
    });

    it('broadcastEvent() -> all connected clients receive formatted SSE data', () => {
        const taskId = 'task-2';
        sse.addClient(taskId, mockRes as Response);

        sse.broadcastToTask(taskId, 'update', { progress: 50 });

        const expectedPayload = `event: update\ndata: {"progress":50}\n\n`;
        expect(mockRes.write).toHaveBeenCalledWith(expectedPayload);
    });

    it('client disconnects -> removed from registry, no further events sent', () => {
        const taskId = 'task-3';
        let closeCallback: () => void = () => {};

        mockRes.on = jest.fn().mockImplementation((event, callback) => {
            if (event === 'close') {
                closeCallback = callback;
            }
        });

        sse.addClient(taskId, mockRes as Response);

        // Simulate client disconnect
        closeCallback();

        // Broadcast after disconnect
        sse.broadcastToTask(taskId, 'update', { progress: 80 });

        // write should not be called after disconnect
        expect(mockRes.write).not.toHaveBeenCalled();
    });

    it('event format is correct ("data: {...}\\n\\n")', () => {
        const taskId = 'task-4';
        sse.addClient(taskId, mockRes as Response);

        const data = { message: 'hello' };
        sse.broadcastToTask(taskId, 'message', data);

        const expectedPayload = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
        expect(mockRes.write).toHaveBeenCalledWith(expectedPayload);
    });
});
