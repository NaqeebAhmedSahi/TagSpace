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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  CircularProgress,
  Typography,
  IconButton,
  Link,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TsButton from '../TsButton';
import TsTextField from '../TsTextField';

interface Props {
  open: boolean;
  onClose: () => void;
  parserLoading: boolean;
  parseProgress: number;
  parserText: string;
  parserJSON: string;
  parserLinks?: Array<{url: string; text: string}>;
  totalPages: number;
  pageRange: { start?: number; end?: number };
  onStartParsing: () => void;
  onPageRangeChange: (range: { start?: number; end?: number }) => void;
  filePath?: string;
  fileName?: string;
  isDataSaved?: boolean;
  onSaveToDb?: () => void;
  fileType?: string;
}

export const PDFParserDialog: React.FC<Props> = ({
  open,
  onClose,
  parserLoading,
  parseProgress,
  parserText,
  parserJSON,
  parserLinks = [],
  totalPages,
  pageRange,
  onStartParsing,
  onPageRangeChange,
  filePath,
  fileName,
  isDataSaved = false,
  onSaveToDb,
  fileType,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [showPageRangeDialog, setShowPageRangeDialog] = useState(false);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        keepMounted
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span>
              {parserLoading
                ? t('core:processing') || 'Processing...'
                : (fileType && ['doc','docx','odt','rtf'].includes(fileType)
                    ? t('core:parsedDocument') || 'Parsed Document'
                    : t('core:parsedPdf') || 'Parsed PDF')
              }
            </span>
            {!parserLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                {parserJSON && onSaveToDb && (
                  <TsButton
                    onClick={onSaveToDb}
                    variant="outlined"
                    size="small"
                    color="primary"
                  >
                    {t('core:saveToDb') || 'Save to DB'}
                  </TsButton>
                )}
                <TsButton
                  onClick={() => setShowPageRangeDialog(true)}
                  variant="contained"
                  size="small"
                >
                  {fileType && ['doc','docx','odt','rtf'].includes(fileType)
                    ? t('core:parseDocument') || 'Parse Document'
                    : t('core:parseNewPages') || 'Parse New Pages'
                  }
                </TsButton>
              </Box>
            )}
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {parserLoading ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              gap: 2
            }}>
              <CircularProgress 
                size={48} 
                sx={{ 
                  color: theme.palette.primary.main,
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  }
                }} 
              />
              {parseProgress > 0 && (
                <Typography 
                  sx={{ 
                    mt: 2,
                    color: theme.palette.text.primary,
                    fontWeight: 500
                  }}
                >
                  {Math.round(parseProgress * 100)}% Complete
                </Typography>
              )}
            </Box>
          ) : (
            <Box>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab label={t('core:extractedText') || 'Extracted Text'} />
                {parserLinks.length > 0 && <Tab label={`Links (${parserLinks.length})`} />}
                {parserJSON && <Tab label="JSON Result" />}
              </Tabs>
              <Box role="tabpanel" hidden={activeTab !== 0}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                  {parserText || t('core:noTextExtracted')}
                </pre>
              </Box>
              {parserLinks.length > 0 && (
                <Box role="tabpanel" hidden={activeTab !== 1}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {t('core:extractedLinks') || 'Extracted Links'} ({parserLinks.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {parserLinks.map((link, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: theme.palette.background.paper,
                          }}
                        >
                          <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
                            {link.text}
                          </Typography>
                          <Link
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ wordBreak: 'break-all' }}
                          >
                            {link.url}
                          </Link>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              )}
              {parserJSON && (
                <Box role="tabpanel" hidden={activeTab !== (parserLinks.length > 0 ? 2 : 1)}>
                  <Box sx={{ mb: 2 }}>
                    <TsButton
                      onClick={() => {
                        navigator.clipboard.writeText(parserJSON);
                        // showNotification is handled by parent component
                      }}
                      size="small"
                    >
                      {t('core:copyToClipboard') || 'Copy to Clipboard'}
                    </TsButton>
                  </Box>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    padding: '8px',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: '4px'
                  }}>
                    {parserJSON}
                  </pre>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPageRangeDialog}
        onClose={() => setShowPageRangeDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('core:selectPageRange') || 'Select Page Range'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <TsTextField
              label="Start Page"
              type="number"
              fullWidth
              value={pageRange.start || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 0 && (!pageRange.end || value <= pageRange.end)) {
                  onPageRangeChange({ ...pageRange, start: value });
                }
              }}
              inputProps={{ min: 1, max: totalPages || 999999 }}
            />
            <TsTextField
              label="End Page"
              type="number"
              fullWidth
              value={pageRange.end || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && (!pageRange.start || value >= pageRange.start)) {
                  onPageRangeChange({ ...pageRange, end: value });
                }
              }}
              inputProps={{ min: pageRange.start || 1, max: totalPages || 999999 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <TsButton onClick={() => setShowPageRangeDialog(false)}>
            {t('core:cancel')}
          </TsButton>
          <TsButton
            onClick={() => {
              setShowPageRangeDialog(false);
              onStartParsing();
            }}
            variant="contained"
          >
            {t('core:process')}
          </TsButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PDFParserDialog;