import React from 'react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

interface QueryResultsProps {
  result: any;
}

export default function QueryResults({ result }: QueryResultsProps) {
  if (!result) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No results to display</Typography>
      </Box>
    );
  }

  // Normalize a few possible shapes we might receive from IPC:
  // - a single result object { rows, columns }
  // - an array of result objects [ { rows, columns }, ... ]
  // - wrapped response { result: { rows, columns } }
  let normalized: any = result;
  if (Array.isArray(result) && result.length > 0) {
    normalized = result[0];
  }
  if (result && result.result) {
    normalized = result.result;
  }

  const rows = normalized?.rows || [];
  const columns = normalized?.columns || normalized?.fields || [];

  // If rows are empty but the normalized object looks like an array of plain
  // objects (e.g. [{id:1,...}, ...]) treat that as rows and synthesize columns.
  let finalRows = rows;
  let finalColumns = columns;
  if ((!finalRows || finalRows.length === 0) && Array.isArray(normalized) && normalized.length > 0 && typeof normalized[0] === 'object') {
    finalRows = normalized as any[];
    // synthesize columns from keys
    finalColumns = Object.keys(finalRows[0] || {}).map((k) => ({ name: k, id: k }));
  }

  // As a last resort, if there are no columns but there are rows with keys,
  // synthesize columns from the first row.
  if ((!finalColumns || finalColumns.length === 0) && finalRows && finalRows.length > 0 && typeof finalRows[0] === 'object') {
    finalColumns = Object.keys(finalRows[0]).map((k) => ({ name: k, id: k }));
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <TableContainer component={Paper}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col: any, index: number) => (
                <TableCell key={index}>{col.name || col.field || `Column ${index + 1}`}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {finalRows.map((row: any, rowIndex: number) => (
              <TableRow key={rowIndex}>
                {finalColumns.map((col: any, colIndex: number) => {
                  const value = Array.isArray(row) ? row[colIndex] : row[col.name || col.field || col.id];
                  return (
                    <TableCell key={colIndex}>
                      {value !== null && value !== undefined ? String(value) : 'NULL'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ p: 1 }}>
        <Typography variant="caption">
          {finalRows.length} row{finalRows.length !== 1 ? 's' : ''} returned
        </Typography>
      </Box>
    </Box>
  );
}
