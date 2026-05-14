import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDB(): Promise<void> {
    try {
        mongoose.set('strictQuery', true);

        mongoose.connection.on('connected', () => {
            logger.info('✅  MongoDB connected', {
                uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@'),
            });
        });

        mongoose.connection.on('error', err => {
            logger.error('MongoDB connection error', { error: err.message });
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected — retrying...');
        });

        await mongoose.connect(env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
        });
    } catch (error) {
        logger.error('❌  Failed to connect to MongoDB', { error });
        process.exit(1);
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
}
