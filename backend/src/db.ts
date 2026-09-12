import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const dbConnectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_PUBLIC_URL;

const isInternalDb = Boolean(
  dbConnectionString && (
    dbConnectionString.includes('railway.internal') ||
    dbConnectionString.includes('localhost') ||
    dbConnectionString.includes('127.0.0.1')
  )
);

const poolConfig: pg.PoolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(dbConnectionString
    ? {
      connectionString: dbConnectionString,
      ssl: isInternalDb ? false : { rejectUnauthorized: false },
      password: String(process.env.PGPASSWORD || process.env.DB_PASSWORD || 'admin'),
    }
    : {
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.PGPORT || process.env.DB_PORT) || 5432,
      database: process.env.PGDATABASE || process.env.DB_NAME || 'revenue_treasury',
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: String(process.env.PGPASSWORD || process.env.DB_PASSWORD || 'admin'),
    }),
};

const pool = new Pool(poolConfig);

pool.on('error', (err: Error) => {
  console.error(' Unexpected PostgreSQL client error:', err.message);
});

export default pool;
