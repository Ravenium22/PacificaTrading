import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('[Database] Connection established successfully');
  } catch (error) {
    console.error('[Database] Unable to connect:', error);
    throw error;
  }
}

export async function syncDatabase(): Promise<void> {
  try {
    await sequelize.sync({ alter: false });
    console.log('[Database] Models synchronized');
  } catch (error) {
    console.error('[Database] Sync error:', error);
    throw error;
  }
}