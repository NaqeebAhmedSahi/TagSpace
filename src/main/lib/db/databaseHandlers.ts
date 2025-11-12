import { ipcMain } from 'electron';
import { databaseService, DatabaseConnection } from './DatabaseService';
import { IDbConnectionServer, IDbConnectionDatabase } from './types';

export function setupDatabaseHandlers() {
  // Create new connection
  ipcMain.handle('database:create-connection', async (event, {
    name,
    type,
    config,
    database
  }: {
    name: string;
    type: 'mysql' | 'postgresql' | 'sqlite';
    config: any;
    database?: IDbConnectionDatabase;
  }) => {
    try {
      const connectionId = await databaseService.createConnection(name, type, config, database);
      return { success: true, connectionId };
    } catch (error: any) {
      console.error('Error creating database connection:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      return { success: false, error: errorMessage };
    }
  });

  // Disconnect
  ipcMain.handle('database:disconnect', async (event, connectionId: string) => {
    try {
      await databaseService.disconnect(connectionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Execute query
  ipcMain.handle('database:execute-query', async (event, {
    connectionId,
    query
  }: {
    connectionId: string;
    query: string;
  }) => {
    try {
      const result = await databaseService.executeQuery(connectionId, query);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get all connections
  ipcMain.handle('database:get-connections', async () => {
    return databaseService.getAllConnections();
  });

  // Get connection
  ipcMain.handle('database:get-connection', async (event, connectionId: string) => {
    return databaseService.getConnection(connectionId);
  });

  // Set active connection
  ipcMain.handle('database:set-active-connection', async (event, connectionId: string) => {
    databaseService.setActiveConnection(connectionId);
    return { success: true };
  });

  // Get active connection
  ipcMain.handle('database:get-active-connection', async () => {
    return databaseService.getActiveConnection();
  });

  // List databases (for MySQL/PostgreSQL)
  ipcMain.handle('database:list-databases', async (event, connectionId: string) => {
    try {
      const connection = databaseService.getConnection(connectionId);
      if (!connection || !connection.client) {
        throw new Error('Connection not found');
      }
      const databases = await connection.client.listDatabases();
      return { success: true, databases };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // List tables
  ipcMain.handle('database:list-tables', async (event, {
    connectionId,
    database,
    schema
  }: {
    connectionId: string;
    database?: string;
    schema?: string;
  }) => {
    try {
      const connection = databaseService.getConnection(connectionId);
      if (!connection || !connection.client) {
        throw new Error('Connection not found');
      }
      const tables = await connection.client.listTables({ database, schema });
      return { success: true, tables };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}