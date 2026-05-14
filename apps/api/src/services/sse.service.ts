import { Response } from 'express';

const clients: Map<string, Set<Response>> = new Map();

export const sse = {
    addClient: (taskId: string, res: Response) => {
        if (!clients.has(taskId)) {
            clients.set(taskId, new Set());
        }
        clients.get(taskId)!.add(res);

        res.on('close', () => {
            clients.get(taskId)?.delete(res);
            if (clients.get(taskId)?.size === 0) {
                clients.delete(taskId);
            }
        });
    },

    broadcastToTask: (taskId: string, event: string, data: any) => {
        const taskClients = clients.get(taskId);
        if (taskClients && taskClients.size > 0) {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            taskClients.forEach(client => {
                client.write(payload);
            });

            // Close connection automatically if task reaches terminal state
            if (data.status === 'completed' || data.status === 'failed') {
                taskClients.forEach(client => {
                    client.end();
                });
                clients.delete(taskId);
            }
        }
    },
};
