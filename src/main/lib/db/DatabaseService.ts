import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import { IDbConnectionDatabase } from './types';
import { MysqlClient } from './clients/mysql';
import { PostgresClient } from './clients/postgresql';
import { SqliteClient } from './clients/sqlite';
import { BasicDatabaseClient } from './clients/BasicDatabaseClient';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite';
  // config can be a server wrapper or a plain server config object from the UI
  config: any;
  client?: BasicDatabaseClient<any>;
  connected: boolean;
}

export class DatabaseService extends EventEmitter {
  private connections: Map<string, DatabaseConnection> = new Map();
  private activeConnectionId: string | null = null;
  private connectionsConfigPath: string;

  constructor() {
    super();
    // Initialize the connections config file path (stored in userData folder)
    try {
      const userData = app.getPath('userData');
      this.connectionsConfigPath = path.join(userData, 'database-connections.json');
    } catch (e) {
      // fallback if app is not available
      this.connectionsConfigPath = path.join(process.cwd(), 'database-connections.json');
    }
  }

  /**
   * Load saved connection metadata from disk (non-connected state).
   * This is called during app initialization to restore previously created connections.
   * Note: Connections are not automatically reconnected; they show as disconnected
   * until the user explicitly connects.
   */
  async loadSavedConnections(): Promise<void> {
    try {
      if (!fs.existsSync(this.connectionsConfigPath)) {
        console.log('No saved database connections found');
        return;
      }

      const data = await fs.readJson(this.connectionsConfigPath);
      if (!Array.isArray(data)) {
        console.warn('Invalid saved connections format');
        return;
      }

      console.log(`Loading ${data.length} saved database connections`);
      for (const connData of data) {
        try {
          const connection: DatabaseConnection = {
            id: connData.id,
            name: connData.name,
            type: connData.type,
            config: connData.config,
            connected: false, // Start as disconnected
            // client will be set when user explicitly connects
          };
          this.connections.set(connection.id, connection);
        } catch (e) {
          console.error(`Failed to load connection ${connData.id}:`, e);
        }
      }

      console.log(`Successfully loaded ${this.connections.size} database connections`);
    } catch (error) {
      console.error('Error loading saved connections:', error);
    }
  }

  /**
   * Save connection metadata to disk (with passwords for now since this is a dev tool).
   * This is called whenever a new connection is created.
   */
  private async saveConnectionsToDisk(): Promise<void> {
    try {
      const connectionsData = Array.from(this.connections.values()).map((conn) => ({
        id: conn.id,
        name: conn.name,
        type: conn.type,
        config: conn.config, // Keep full config including passwords for dev tool
      }));

      await fs.ensureDir(path.dirname(this.connectionsConfigPath));
      await fs.writeJson(this.connectionsConfigPath, connectionsData, { spaces: 2 });
      console.log(`Saved ${connectionsData.length} connections to disk`);
    } catch (error) {
      console.error('Error saving connections to disk:', error);
    }
  }

  async createConnection(
    name: string,
    type: 'mysql' | 'postgresql' | 'sqlite',
    config: any,
    database?: IDbConnectionDatabase
  ): Promise<string> {
    // Validate required fields based on type
    if (type !== 'sqlite') {
      if (!config.host) {
        throw new Error('Host is required for MySQL/PostgreSQL connections');
      }
      if (!config.user) {
        throw new Error('Username is required for MySQL/PostgreSQL connections');
      }
    } else {
      if (!config.database && (!database || !database.database)) {
        throw new Error('Database file path is required for SQLite connections');
      }
    }

    const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connection: DatabaseConnection = {
      id,
      name,
      type,
      config,
      connected: false,
    };

    // Normalize incoming server/config shape: renderer passes a plain server config
    // object (IDbConnectionServerConfig). The clients expect an IDbConnectionServer
    // with a `config` property and `db` map. Wrap when needed.
    let serverObj = config as any;
    if (!serverObj || !serverObj.config) {
      serverObj = {
        db: {},
        config: config as any,
      } as any;
    }

    // Create appropriate client
  let client: BasicDatabaseClient<any>;
    const dbConfig: IDbConnectionDatabase = database || { database: (serverObj.config && (serverObj.config as any).defaultDatabase) || '' } as any;

    switch (type) {
      case 'mysql':
        client = new MysqlClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
        break;
      case 'postgresql':
        client = new PostgresClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
        break;
      case 'sqlite':
        client = new SqliteClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
        break;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    try {
      console.log('Attempting DB connect', { id, name, type, db: dbConfig && (dbConfig as any).database });
      await client.connect();
      connection.client = client;
      connection.connected = true;
      this.connections.set(id, connection);
      this.emit('connection-created', connection);
      // Save the connection to disk so it persists across app restarts
      await this.saveConnectionsToDisk();
      return id;
    } catch (error) {
      // Log detailed error information for debugging
      try {
        const cfg = JSON.parse(JSON.stringify({ config, dbConfig }));
        console.error('Failed to create DB connection', { id, name, type, cfg, error: (error && (error as Error).stack) ? (error as Error).stack : error });
      } catch (e) {
        console.error('Failed to create DB connection (stringify failed)', { id, name, type, error });
      }

      // rethrow original error so callers can handle specific error types
      throw (error instanceof Error) ? error : new Error(String(error));
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.client) {
      await connection.client.disconnect();
    }

    this.connections.delete(connectionId);
    this.emit('connection-closed', connectionId);
    // Persist the removal to disk
    await this.saveConnectionsToDisk();
  }

  async reconnect(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    try {
      // If already connected, skip
      if (connection.connected && connection.client) {
        console.log(`Connection ${connectionId} is already connected`);
        return true;
      }

      // Recreate the client with the saved config
      let client: BasicDatabaseClient<any>;
      let serverObj = connection.config as any;
      if (!serverObj || !serverObj.config) {
        serverObj = {
          db: {},
          config: connection.config as any,
        } as any;
      }

      const dbConfig: IDbConnectionDatabase = { database: (serverObj.config && (serverObj.config as any).defaultDatabase) || '' } as any;

      console.log('Reconnect: Creating client', { 
        id: connectionId, 
        type: connection.type,
        configKeys: Object.keys(serverObj?.config || {})
      });

      switch (connection.type) {
        case 'mysql':
          client = new MysqlClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
          break;
        case 'postgresql':
          client = new PostgresClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
          break;
        case 'sqlite':
          client = new SqliteClient(serverObj, dbConfig) as unknown as BasicDatabaseClient<any>;
          break;
        default:
          throw new Error(`Unsupported database type: ${connection.type}`);
      }

      console.log('Attempting DB reconnect', { id: connectionId, name: connection.name, type: connection.type });
      await client.connect();
      connection.client = client;
      connection.connected = true;
      this.emit('connection-reconnected', connection);
      console.log('Reconnect successful', { id: connectionId, name: connection.name });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('Failed to reconnect', { 
        connectionId, 
        name: connection.name,
        type: connection.type,
        error: errorMsg,
        stack: errorStack 
      });
      connection.connected = false;
      connection.client = undefined;
      throw error;
    }
  }

  async executeQuery(connectionId: string, query: string): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.client) {
      throw new Error('Connection not found or not connected');
    }
    // Prefer the synchronous executeQuery flow implemented by clients which
    // returns fully materialized results (NgQueryResult[]). Returning the
    // CancelableQuery object (from client.query()) caused IPC cloning errors
    // because it contains functions/closures.
    const raw = await connection.client.executeQuery(query);

    // Sanitize the result so it's safe to send over Electron IPC. This will
    // convert BigInt -> string and Buffer/TypedArray -> base64 string, and
    // recursively handle objects/arrays.
    const serializeValue = (v: any): any => {
      if (v === null || v === undefined) return v;
      if (typeof v === 'bigint') return v.toString();
      if (Buffer && Buffer.isBuffer && Buffer.isBuffer(v)) return { __buffer: true, data: v.toString('base64') };
      if (ArrayBuffer.isView && ArrayBuffer.isView(v)) return { __typedarray: true, data: Buffer.from(v as any).toString('base64') };
      if (Array.isArray(v)) return v.map(serializeValue);
      if (typeof v === 'object') {
        const out: any = {};
        for (const [k, val] of Object.entries(v)) {
          out[k] = serializeValue(val);
        }
        return out;
      }
      return v;
    };

    const sanitized = (raw || []).map((res: any) => ({
      command: res.command,
      rowCount: res.rowCount,
      affectedRows: res.affectedRows,
      fields: Array.isArray(res.fields) ? res.fields.map((f: any) => ({ ...(f || {}) })) : res.fields,
      rows: Array.isArray(res.rows) ? res.rows.map((r: any) => serializeValue(r)) : res.rows,
    }));

    // Log sanitized result to the main process console so you can inspect
    // returned rows/server-side when running in development.
    try {
      console.log('DB Query Result', { connectionId, query, resultSummary: sanitized.map((s: any) => ({ command: s.command, rowCount: s.rowCount, affectedRows: s.affectedRows })), sampleRows: sanitized[0] ? (sanitized[0].rows || []).slice(0, 5) : [] });
    } catch (e) {
      // don't let logging failures block the response
      console.error('Failed to log DB query result', e);
    }

    return sanitized;
  }

  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): DatabaseConnection[] {
    // Return a minimal, serializable summary for IPC consumers.
    return Array.from(this.connections.values()).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      connected: c.connected,
    } as DatabaseConnection));
  }

  setActiveConnection(connectionId: string): void {
    this.activeConnectionId = connectionId;
    this.emit('active-connection-changed', connectionId);
  }

  getActiveConnection(): DatabaseConnection | null {
    if (!this.activeConnectionId) return null;
    return this.connections.get(this.activeConnectionId) || null;
  }
}

export const databaseService = new DatabaseService();