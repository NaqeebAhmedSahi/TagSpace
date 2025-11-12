// Copyright (c) 2015 The SQLECTRON Team
import _ from 'lodash'
import log from 'electron-log'
import { TableChanges, TableDelete, TableFilter, TableInsert, TableUpdate, BuildInsertOptions } from '../models'
import { IdentifyResult } from 'sql-query-identifier/lib/defines'
// Optional AWS SDK dependencies - stub if not available
let fromIni: any = null;
let Signer: any = null;
let loadSharedConfigFiles: any = null;
try {
  fromIni = require("@aws-sdk/credential-providers").fromIni;
  Signer = require("@aws-sdk/rds-signer").Signer;
  loadSharedConfigFiles = require("@aws-sdk/shared-ini-file-loader").loadSharedConfigFiles;
} catch (e) {
  // AWS SDK not available, that's okay for basic functionality
}
// Stub functions for missing dependencies
function joinFilters(filters: any[]): any {
  return filters;
}

const utilsLog = log.scope('database:db:util');
const logger = () => utilsLog;

export class ClientError extends Error {
  helpLink = null
  constructor(message: string, helpLink: string) {
    super(message)
    this.name = 'ClientError'
    this.helpLink = helpLink
  }
}

export function escapeString(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

export function buildDatabaseFilter(filters: TableFilter[], dialect: string): string {
  if (!filters || filters.length === 0) return ''

  const allFilters = filters.map((item) => {
    if (item.type === 'isNull') {
      return `${item.field} IS NULL`
    } else if (item.type === 'isNotNull') {
      return `${item.field} IS NOT NULL`
    } else if (item.type === 'in') {
      const values = Array.isArray(item.value) ? item.value : [item.value]
      return `${item.field} IN (${values.map(escapeString).join(', ')})`
    } else if (item.type === 'notIn') {
      const values = Array.isArray(item.value) ? item.value : [item.value]
      return `${item.field} NOT IN (${values.map(escapeString).join(', ')})`
    } else if (item.type === 'between') {
      return `${item.field} BETWEEN ${escapeString(item.value[0])} AND ${escapeString(item.value[1])}`
    } else if (item.type === 'like') {
      return `${item.field} LIKE ${escapeString(item.value)}`
    } else if (item.type === 'notLike') {
      return `${item.field} NOT LIKE ${escapeString(item.value)}`
    } else {
      return `${item.field} ${item.type.toUpperCase()} ?`
    }
  })
  return "WHERE " + joinFilters(allFilters, filters)
}

export function buildSchemaFilter(schema: string | null): string {
  if (!schema) return ''
  return `AND table_schema = ${escapeString(schema)}`
}

export function buildSelectQueriesFromUpdates(knex: any, updates: TableUpdate[]): string[] {
  return updates.map((update) => {
    const where = buildDatabaseFilter(update.filters || [], 'generic')
    return knex(update.table).select('*').whereRaw(where.replace('WHERE ', '')).toQuery()
  })
}

export function buildUpdateQueries(knex: any, updates: TableUpdate[]): string[] {
  return updates.map((update) => {
    const where = buildDatabaseFilter(update.filters || [], 'generic')
    const set = Object.keys(update.data).map((key) => `${key} = ?`).join(', ')
    return knex(update.table).update(update.data).whereRaw(where.replace('WHERE ', '')).toQuery()
  })
}

export function buildDeleteQueries(knex: any, deletes: TableDelete[]): string[] {
  return deletes.map((deleteItem) => {
    const where = buildDatabaseFilter(deleteItem.filters || [], 'generic')
    return knex(deleteItem.table).whereRaw(where.replace('WHERE ', '')).delete().toQuery()
  })
}

export function buildInsertQuery(knex: any, insert: TableInsert, columns: any[], primaryKeys: string[] = [], runAsUpsert: boolean = false, createUpsertFunc: any = null, bitConversionFunc: any = (v: any) => v): string {
  const data = _.cloneDeep(insert.data)
  const canRunAsUpsert = _.intersection(Object.keys(data[0]), primaryKeys).length === primaryKeys.length && runAsUpsert
  data.forEach((item) => {
    const insertColumns = Object.keys(item)
    insertColumns.forEach((ic) => {
      const matching = _.find(columns, (c) => c.columnName === ic)
      if (matching && matching.dataType && matching.dataType.startsWith('bit(') && !_.isNil(item[ic])) {
        if (matching.dataType === 'bit(1)') {
          item[ic] = bitConversionFunc(item[ic])
        } else {
          item[ic] = parseInt(item[ic].split("'")[1], 2)
        }
      } else if (matching && matching.dataType && matching.dataType.startsWith('bit') && _.isBoolean(item[ic])) {
        item[ic] = item[ic] ? 1 : 0;
      }
      // HACK (@day): fixes #1734. Knex reads any '?' in identifiers as a parameter, so we need to escape any that appear.
      if (ic.includes('?')) {
        const newIc = ic.replaceAll('?', '\\?');
        item[newIc] = item[ic];
        delete item[ic];
      }
    })

  })

  const table = insert.dataset ? `${insert.dataset}.${insert.table}` : insert.table;
  const builder = knex(table);

  if (insert.schema) {
    builder.withSchema(insert.schema)
  }

  if (canRunAsUpsert && typeof(createUpsertFunc) === 'function'){
    return createUpsertFunc({ schema: insert.schema, name: insert.table, entityType: 'table' }, data, primaryKeys)
  } else if (canRunAsUpsert) {
    // https://knexjs.org/guide/query-builder.html#onconflict
    return builder
      .insert(data)
      .onConflict(primaryKeys)
      .merge()
      .toQuery()
  }

  return builder
    .insert(data)
    .toQuery()
}

export function buildInsertQueries(knex, inserts, { runAsUpsert = false, primaryKeys = [], createUpsertFunc = null } = {}) {
  if (!inserts) return []
  return inserts.map((insert) => buildInsertQuery(knex, insert, [], primaryKeys, runAsUpsert, createUpsertFunc))
}

export function buildSelectTopQuery(table, offset, limit, orderBy, filters, countTitle = 'total', columns = [], selects = ['*']) {
  logger().debug('building selectTop for', table, offset, limit, orderBy, selects)
  let orderByString = ""

  if (orderBy && orderBy.length > 0) {
    orderByString = "ORDER BY " + (orderBy.map((item: any) => {
      if (_.isObject(item)) {
        return `${item.field} ${item.direction || 'ASC'}`
      }
      return item
    }).join(', '))
  }

  let filterString = ""
  let filterParams: any[] = []

  if (filters && filters.length > 0) {
    const allFilters = filters.map((item) => {
      if (item.type === 'isNull') {
        return `${item.field} IS NULL`
      } else if (item.type === 'isNotNull') {
        return `${item.field} IS NOT NULL`
      } else if (item.type === 'in') {
        const values = Array.isArray(item.value) ? item.value : [item.value]
        return `${item.field} IN (${values.map(escapeString).join(', ')})`
      } else if (item.type === 'notIn') {
        const values = Array.isArray(item.value) ? item.value : [item.value]
        return `${item.field} NOT IN (${values.map(escapeString).join(', ')})`
      } else if (item.type === 'between') {
        return `${item.field} BETWEEN ${escapeString(item.value[0])} AND ${escapeString(item.value[1])}`
      } else if (item.type === 'like') {
        return `${item.field} LIKE ${escapeString(item.value)}`
      } else if (item.type === 'notLike') {
        return `${item.field} NOT LIKE ${escapeString(item.value)}`
      }
      return `${item.field} ${item.type.toUpperCase()} ?`
    })
    filterString = "WHERE " + joinFilters(allFilters, filters)

    logger().info('FILTER: ', filterString)

    filterParams = filters.filter((item) => !!item.value).flatMap((item) => {
      return _.isArray(item.value) ? item.value : [item.value]
    })
  }

  const selectString = selects.join(', ')
  const query = `SELECT ${selectString} FROM ${table} ${filterString} ${orderByString} LIMIT ${limit} OFFSET ${offset}`
  const countQuery = `SELECT COUNT(*) as ${countTitle} FROM ${table} ${filterString}`

  return {
    query,
    countQuery,
    params: filterParams
  }
}

export function joinQueries(queries: string[]): string {
  if (!queries || queries.length === 0) return ''
  const joined = queries.join(';\n')
  return joined.endsWith(';') ? joined : `${joined};`
}

export async function refreshTokenIfNeeded(redshiftOptions: any, server: any, port: number): Promise<string | null> {
  // Stub: AWS token refresh not implemented yet
  // This is only needed for AWS RDS/Redshift IAM authentication
  return null;
}

export async function getIAMPassword(redshiftOptions: any, hostname: string, port: number, username: string): Promise<string> {
  // Stub: AWS IAM password generation not implemented yet
  throw new Error('AWS IAM authentication not yet implemented');
}

// Error messages used by clients
export const errorMessages = {
  readOnly: 'The database is opened in read-only mode and this query is not allowed.'
};

// Determine whether the set of identified statements are allowed when DB is in read-only mode
export function isAllowedReadOnlyQuery(statements: IdentifyResult[], readOnlyMode: boolean): boolean {
  // If not in read-only mode, all queries are allowed
  if (!readOnlyMode) return true;
  if (!statements || statements.length === 0) return true;

  // allow only select-like statements when in read-only mode
  for (const st of statements) {
    const t = (st.type || '').toString().toLowerCase();
    // permit SELECT, PRAGMA and EXPLAIN (and possibly other safe commands)
    if (t === 'select' || t === 'pragma' || t === 'explain' || t === 'describe' || t === 'show') {
      continue;
    }
    return false;
  }

  return true;
}

// Very small applyChangesSql implementation used by BasicDatabaseClient
export function applyChangesSql(changes: any, knex: any): string {
  const queries: string[] = [];
  if (!changes) return '';
  if (changes.inserts) {
    queries.push(...buildInsertQueries(knex, changes.inserts));
  }
  if (changes.updates) {
    // buildUpdateQueries exists above and returns SQL strings
    queries.push(...buildUpdateQueries(knex, changes.updates));
  }
  if (changes.deletes) {
    queries.push(...buildDeleteQueries(knex, changes.deletes));
  }

  return joinQueries(queries);
}
