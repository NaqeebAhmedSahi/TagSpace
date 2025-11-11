/**
 * BWS Vittoria - universal file and folder organizer
 * Copyright (C) 2017-present BWS Vittoria GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License (version 3) as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

import React from 'react';
import { useGridCellsStyleContext } from '../hooks/useGridCellsStyleContext';

export type GridCellsContainerProps = {
  children: React.ReactNode;
};

export const GridCellsContainer = ({ children }: GridCellsContainerProps) => {
  const { cellsStyle } = useGridCellsStyleContext();

  return (
    <div 
      style={{
        ...cellsStyle,
        flex: 1,
        overflow: 'auto',
        minHeight: 0,
      }} 
      data-tid="perspectiveGridFileTable"
      sx={{
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
        }
      }}
    >
      {children}
    </div>
  );
};

export default GridCellsContainer;
