/**
 * BWS Vittoria - universal file and folder organizer
 * Copyright (C) 2024-present BWS Vittoria GmbH
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
 */

import AppConfig from '-/AppConfig';

interface PdfDataRow {
  id: number;
  file_path: string;
  file_name: string;
  parsed_text: string;
  parsed_json: string;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize the PDF data database
 */
export async function initPdfDataDb(): Promise<boolean> {
  if (!AppConfig.isElectron) {
    console.warn('PDF data storage only available in Electron');
    return false;
  }

  try {
    // @ts-ignore - exposed in preload
    const result = await window.electronIO.ipcRenderer.invoke('pdf-data-init');
    return result?.success === true;
  } catch (error) {
    console.error('Failed to initialize PDF data database:', error);
    return false;
  }
}

/**
 * Save PDF parsed data to database
 */
export async function savePdfData(
  filePath: string,
  fileName: string,
  parsedText: string,
  parsedJson: string,
): Promise<{ success: boolean; message?: string }> {
  if (!AppConfig.isElectron) {
    return { success: false, message: 'Only available in Electron' };
  }

  try {
    // @ts-ignore - exposed in preload
    const result = await window.electronIO.ipcRenderer.invoke(
      'pdf-data-save',
      filePath,
      fileName,
      parsedText,
      parsedJson,
    );
    return result || { success: false, message: 'Unknown error' };
  } catch (error) {
    console.error('Failed to save PDF data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load PDF parsed data from database
 */
export async function loadPdfData(
  filePath: string,
): Promise<{ success: boolean; data?: PdfDataRow; message?: string }> {
  if (!AppConfig.isElectron) {
    return { success: false, message: 'Only available in Electron' };
  }

  try {
    // @ts-ignore - exposed in preload
    const result = await window.electronIO.ipcRenderer.invoke(
      'pdf-data-load',
      filePath,
    );
    return result || { success: false, message: 'Unknown error' };
  } catch (error) {
    console.error('Failed to load PDF data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if PDF data exists in database for a file
 */
export async function checkPdfDataExists(
  filePath: string,
): Promise<boolean> {
  if (!AppConfig.isElectron) {
    return false;
  }

  try {
    // @ts-ignore - exposed in preload
    const result = await window.electronIO.ipcRenderer.invoke(
      'pdf-data-check',
      filePath,
    );
    return result?.success === true && result?.exists === true;
  } catch (error) {
    console.error('Failed to check PDF data:', error);
    return false;
  }
}

