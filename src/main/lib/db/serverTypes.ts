import { BasicDatabaseClient } from './BasicDatabaseClient';
import { IDbConnectionServerConfig } from './types';

export interface IDbConnectionPublicServer {
  db: (dbName: string) => BasicDatabaseClient<any>
  disconnect: () => void
  end: () => void
  destroyConnection: (dbName?: string) => void
  createConnection: (dbName?: string, cryptoSecret?: string) => BasicDatabaseClient<any>
  versionString: () => Promise<string>
  getServerConfig: () => IDbConnectionServerConfig
}
