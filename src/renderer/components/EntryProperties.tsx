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

import AppConfig from '-/AppConfig';
import Marker2xIcon from '-/assets/icons/marker-icon-2x.png';
import MarkerIcon from '-/assets/icons/marker-icon.png';
import MarkerShadowIcon from '-/assets/icons/marker-shadow.png';
import {
  CalendarIcon,
  ClearColorIcon,
  CloudLocationIcon,
  ColorPaletteIcon,
  IDIcon,
  LocalLocationIcon,
  OpenLinkIcon,
  QrCodeIcon,
  SetColorIcon,
  SizeIcon,
} from '-/components/CommonIcons';
import { ProTooltip } from '-/components/HelperComponents';
import InfoIcon from '-/components/InfoIcon';
import NoTileServer from '-/components/NoTileServer';
import PerspectiveSelector from '-/components/PerspectiveSelector';
import TagDropContainer from '-/components/TagDropContainer';
import TagsSelect from '-/components/TagsSelect';
import Tooltip from '-/components/Tooltip';
import TransparentBackground from '-/components/TransparentBackground';
import TsButton from '-/components/TsButton';
import TsIconButton from '-/components/TsIconButton';
import TsTextField from '-/components/TsTextField';
import LinkGeneratorDialog from '-/components/dialogs/LinkGeneratorDialog';
import { useMenuContext } from '-/components/dialogs/hooks/useMenuContext';
import { useCurrentLocationContext } from '-/hooks/useCurrentLocationContext';
import { useEditedEntryMetaContext } from '-/hooks/useEditedEntryMetaContext';
import { useFilePropertiesContext } from '-/hooks/useFilePropertiesContext';
import { useIOActionsContext } from '-/hooks/useIOActionsContext';
import { useNotificationContext } from '-/hooks/useNotificationContext';
import { useOpenedEntryContext } from '-/hooks/useOpenedEntryContext';
import { useTaggingActionsContext } from '-/hooks/useTaggingActionsContext';
import { getTagDelimiter } from '-/reducers/settings';
import {
  dirNameValidation,
  fileNameValidation,
  getAllTags,
  openUrl,
} from '-/services/utils-io';
import { TS } from '-/tagspaces.namespace';
import { generateClipboardLink } from '-/utils/dom';
import { formatTimestampLocal } from '-/utils/formatLocalTime';
import { parseGeoLocation } from '-/utils/geo';
import useFirstRender from '-/utils/useFirstRender';
import {
  Box,
  FormControl,
  InputAdornment,
  Popover,
  Typography,
  inputBaseClasses,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  CircularProgress,
} from '@mui/material';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { styled, useTheme } from '@mui/material/styles';
import { formatBytes } from '@tagspaces/tagspaces-common/misc';
import {
  extractContainingDirectoryPath,
  extractDirectoryName,
  extractFileName,
  extractTitle,
  extractFileExtension,
} from '@tagspaces/tagspaces-common/paths';
import L from 'leaflet';
import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttributionControl,
  LayerGroup,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from 'react-leaflet';
import { useSelector } from 'react-redux';
import { Pro } from '../pro';
import { extractPDFcontent } from '-/services/thumbsgenerator';
import { extractDocContent } from '-/services/docParser';
import { processTextWithAI } from '-/services/ai/langchain';
import { useAIConfig } from '-/services/ai/useAIConfig';
import { useSettingsDialogContext } from '-/components/dialogs/hooks/useSettingsDialogContext';
import { SettingsTab } from '-/components/dialogs/SettingsDialog';
import { REDIRECT_TO_AI_SETTINGS_EVENT } from './dialogs/components/SettingsAI';
import PDFParserDialog from './dialogs/PDFParserDialog';
import {
  initPdfDataDb,
  savePdfData,
  loadPdfData,
  checkPdfDataExists,
} from '-/services/pdfDataStorage';

const ThumbnailTextField = styled(TsTextField)(({ theme }) => ({
  [`& .${inputBaseClasses.root}`]: {
    height: 220,
  },
}));

const CustomBackgroundDialog =
  Pro && Pro.UI ? Pro.UI.CustomBackgroundDialog : false;

interface Props {
  tileServer: TS.MapTileServer;
}

const defaultBackgrounds = [
  'transparent',
  '#00000044',
  '#ac725e44',
  '#f83a2244',
  '#ff753744',
  '#ffad4644',
  '#42d69244',
  '#00800044',
  '#7bd14844',
  '#fad16544',
  '#92e1c044',
  '#9fe1e744',
  '#9fc6e744',
  '#4986e744',
  '#9a9cff44',
  '#c2c2c244',
  '#cca6ac44',
  '#f691b244',
  '#cd74e644',
  '#a47ae244',
  '#845EC260',
  '#D65DB160',
  '#FF6F9160',
  '#FF967160',
  '#FFC75F60',
  '#F9F87160',
  '#008E9B60',
  '#008F7A60',
  'linear-gradient(43deg, rgb(65, 88, 208) 0%, rgb(200, 80, 190) 45%, rgb(255, 204, 112) 100%)',
  'linear-gradient( 102deg,  rgba(253,189,85,1) 8%, rgba(249,131,255,1) 100% )',
  'radial-gradient( circle farthest-corner at 1.4% 2.8%,  rgba(240,249,249,1) 0%, rgba(182,199,226,1) 100% )',
  'linear-gradient( 110deg,  rgba(48,207,208,1) 11.2%, rgba(51,8,103,1) 90% )',
];

function EntryProperties({ tileServer }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { openedEntry, sharingLink, getOpenedDirProps, fileChanged } =
    useOpenedEntryContext();
  const { openMoveCopyFilesDialog } = useMenuContext();
  const { isEditMode } = useFilePropertiesContext();
  const {
    renameDirectory,
    renameFile,
    setBackgroundColorChange,
    saveDirectoryPerspective,
  } = useIOActionsContext();
  const { metaActions } = useEditedEntryMetaContext();
  const { addTagsToFsEntry, removeTagsFromEntry } = useTaggingActionsContext();
  const { findLocation } = useCurrentLocationContext();
  const { showNotification, openConfirmDialog } = useNotificationContext();
  const { openSettingsDialog } = useSettingsDialogContext();
  const { config: aiConfig, isValid: aiConfigValid, isLoading: aiConfigLoading } = useAIConfig();
  const thumbDialogContext = Pro?.contextProviders?.ThumbDialogContext
    ? useContext<TS.ThumbDialogContextData>(
        Pro.contextProviders.ThumbDialogContext,
      )
    : undefined;
  const bgndDialogContext = Pro?.contextProviders?.BgndDialogContext
    ? useContext<TS.BgndDialogContextData>(
        Pro.contextProviders.BgndDialogContext,
      )
    : undefined;
  const tagDelimiter: string = useSelector(getTagDelimiter);

  const dirProps = useRef<TS.DirProp>();
  const fileNameRef = useRef<HTMLInputElement>(null);
  const sharingLinkRef = useRef<HTMLInputElement>(null);
  const disableConfirmButton = useRef<boolean>(true);
  const fileNameError = useRef<boolean>(false);
  const location = findLocation(openedEntry?.locationID);

  const entryName = useMemo(() => {
    if (!openedEntry) return '';
    return openedEntry.isFile
      ? extractFileName(openedEntry.path, location?.getDirSeparator())
      : extractDirectoryName(openedEntry.path, location?.getDirSeparator());
  }, [openedEntry, location]);

  const [editName, setEditName] = useState<string>();
  const [showSharingLinkDialog, setShowSharingLinkDialog] = useState(false);
  const [displayColorPicker, setDisplayColorPicker] = useState(false);

  const backgroundImage = useRef<string>('none');
  const thumbImage = useRef<string>('none');

  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const firstRender = useFirstRender();

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const popoverOpen = Boolean(popoverAnchorEl);
  const popoverId = popoverOpen ? 'popoverBackground' : undefined;

  const handlePopoverClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setPopoverAnchorEl(event.currentTarget);
    },
    [],
  );
  const handlePopoverClose = useCallback(() => setPopoverAnchorEl(null), []);

  useEffect(() => {
    reloadBackground();
    reloadThumbnails();
    // eslint-disable-next-line
  }, [openedEntry]);

  useEffect(() => {
    if (!firstRender && metaActions && metaActions.length > 0 && openedEntry) {
      for (const action of metaActions) {
        if (action.action === 'bgdImgChange') {
          reloadBackground();
        } else if (action.action === 'thumbChange') {
          reloadThumbnails();
        }
      }
    }
    // eslint-disable-next-line
  }, [metaActions, openedEntry]);

  function reloadBackground() {
    if (location && openedEntry) {
      location
        .getFolderBgndPath(openedEntry.path, openedEntry.meta?.lastUpdated)
        .then((bgPath) => {
          const bgImage = bgPath ? `url("${bgPath}")` : 'none';
          if (bgImage !== backgroundImage.current) {
            backgroundImage.current = bgImage;
            forceUpdate();
          }
        });
    }
  }

  function reloadThumbnails() {
    if (location && openedEntry) {
      location
        .getThumbPath(
          openedEntry.meta?.thumbPath,
          openedEntry.meta?.lastUpdated,
        )
        .then((thumbPath) => {
          const thbImage = thumbPath
            ? `url("${thumbPath.replace(/#/g, '%23')}")`
            : 'none';
          if (thbImage !== thumbImage.current) {
            thumbImage.current = thbImage;
            forceUpdate();
          }
        });
    }
  }

  const [parserOpen, setParserOpen] = useState(false);
  const [parserText, setParserText] = useState<string>('');
  const [parserJSON, setParserJSON] = useState<string>('');
  const [parserLinks, setParserLinks] = useState<Array<{url: string; text: string}>>([]);
  const [parserLoading, setParserLoading] = useState(false);
  const [loadingFromDb, setLoadingFromDb] = useState(false);
  const [pageRange, setPageRange] = useState<{start?: number; end?: number}>({});
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [isDataSaved, setIsDataSaved] = useState(false);

  const [parseProgress, setParseProgress] = useState(0);

  // Initialize PDF data database on mount
  useEffect(() => {
    initPdfDataDb().catch((error) => {
      console.error('Failed to initialize PDF data database:', error);
    });
  }, []);

  // Check if data exists in DB whenever file changes
  useEffect(() => {
    if (openedEntry?.path) {
      const ext = extractFileExtension(
        openedEntry.name || openedEntry.path,
      )?.toLowerCase();
      if (ext === 'pdf') {
        checkPdfDataExists(openedEntry.path)
          .then((exists) => {
            setIsDataSaved(exists);
          })
          .catch((error) => {
            console.error('Error checking PDF data:', error);
            setIsDataSaved(false);
          });
      } else {
        setIsDataSaved(false);
      }
    } else {
      setIsDataSaved(false);
    }
  }, [openedEntry?.path, openedEntry?.name]);
  
const handleParsePdf = useCallback(async () => {
  if (!location || !openedEntry || !openedEntry.path) {
    console.warn('PDF parsing aborted: Missing location or file entry');
    return;
  }
  
  if (parserLoading) {
    console.warn('PDF parsing already in progress');
    return;
  }

  // Check if AI API key is configured
  const ext = extractFileExtension(openedEntry.name || openedEntry.path)?.toLowerCase();
  const isPdf = ext === 'pdf';
  const isDoc = docLikeExts.includes(ext);
  
  // Wait for config to load if still loading
  if (aiConfigLoading) {
    console.log('[EntryProperties] Waiting for AI config to load...');
    // Don't proceed until config is loaded
    return;
  }
  
  // Try to get the latest active key directly from the DB in case it was just toggled
  let effectiveConfig = aiConfig;
  if (window.electronIO?.ipcRenderer) {
    try {
      // fetch currently active key (may be null)
      // do not block UI for too long, but await here to ensure accurate permission check
      // if this call fails we fall back to the hook-provided config
      // eslint-disable-next-line no-await-in-loop
      const activeKey = await window.electronIO.ipcRenderer.invoke('ai-key-get-active');
      // activeKey will only be returned if is_active = 1 in DB
      if (activeKey?.api_key && activeKey.is_active === 1) {
        effectiveConfig = {
          provider: activeKey.provider,
          apiKey: activeKey.api_key,
          model: activeKey.model || '',
          temperature: activeKey.temperature || 0.7,
        } as any;
      } else {
        effectiveConfig = null; // Clear config if key not active
      }
    } catch (e) {
      // ignore and continue with aiConfig from hook
      // eslint-disable-next-line no-console
      console.warn('[EntryProperties] Failed to read active AI key from DB:', e);
    }
  }

  // Check if AI is properly configured and key is active (status = 1 in DB)
  const hasValidApiKey = effectiveConfig?.apiKey && effectiveConfig.apiKey.trim().length > 0;
  const providerDetected = effectiveConfig?.provider && effectiveConfig.provider !== 'unknown';
  const shouldAllowParsing = effectiveConfig !== null && hasValidApiKey && providerDetected;
  
  if ((isPdf || isDoc) && !shouldAllowParsing) {
    console.warn('[EntryProperties] AI config missing or invalid:', {
      hasConfig: !!aiConfig,
      isValid: aiConfigValid,
      hasApiKey: !!aiConfig?.apiKey,
      apiKeyLength: aiConfig?.apiKey?.length || 0,
      provider: aiConfig?.provider,
      providerDetected,
    });
    // Only show a notification here. Do not redirect to settings automatically.
    showNotification(
      t('core:aiKeyRequiredForParsing') ||
        'AI API key is required to use PDF/Document parser. Click Connect to configure it in Settings.',
      'warning',
    );
    return;
  }

  console.log('Starting PDF parsing process...');
  setParserLoading(true);
  setParseProgress(0);
  setParserText('');
  setParserJSON('');
  setParserLinks([]);

  try {
    console.log('Reading file for parsing:', openedEntry.path, 'ext=', ext);
    const buffer = await location.getFileContentPromise(
      openedEntry.path,
      'arraybuffer',
    );

    let result: { text: string; links: Array<{url: string; text: string}>; numPages: number } = { text: '', links: [], numPages: 0 };

    if (isPdf) {
      console.log('Extracting text from PDF...');
      result = await extractPDFcontent(
        buffer as ArrayBuffer,
        {
          startPage: pageRange.start || 1,
          endPage: pageRange.end || undefined,
        },
        (progress) => {
          const progressPercent = Math.round(progress * 100);
          if (progressPercent % 10 === 0) {
            console.log(`PDF extraction progress: ${progressPercent}%`);
          }
          setParseProgress(progress);
        },
      );
      console.log(`PDF parsed successfully. Total pages: ${result.numPages}`);
      setTotalPages(result.numPages);
    } else if (isDoc) {
      console.log('Extracting text from document (docx/odt/etc)...');
      try {
        const docRes = await extractDocContent(buffer as ArrayBuffer);
        result = { text: docRes.text || '', links: docRes.links || [], numPages: docRes.numPages || 1 };
        console.log(`Document parsed successfully. Items: text length=${(result.text || '').length}, links=${result.links.length}`);
        setTotalPages(result.numPages || 1);
      } catch (docErr) {
        console.error('Error extracting document content:', docErr);
        throw docErr;
      }
    } else {
      console.warn('Unsupported file extension for parsing:', ext);
      setParserText(t('core:unsupportedFileType') || 'Unsupported file type for parsing');
      return;
    }
    
    // Format text with links included
    let formattedText = result.text || t('core:noTextExtracted');
    if (result.links && result.links.length > 0) {
      const linksSection = '\n\n--- Extracted Links ---\n' + 
        result.links.map(link => `${link.text}: ${link.url}`).join('\n');
      formattedText += linksSection;
      setParserLinks(result.links);
    } else {
      setParserLinks([]);
    }
    
    setParserText(formattedText);

    if (!pageRange.end) {
      setPageRange(prev => ({
        start: prev.start || 1,
        end: result.numPages
      }));
    }

    // Only attempt JSON conversion if AI is configured AND we have text
    // Use the same check as above - be lenient if provider is detected
    const canUseAI = aiConfig && aiConfig.apiKey && aiConfig.apiKey.trim().length > 0 && 
                     aiConfig.provider && aiConfig.provider !== 'unknown';
    
    if (canUseAI && result.text && result.text.trim().length > 0) {
      try {
        console.log('Converting text to JSON via AI...');
        console.log('AI Config:', { 
          provider: aiConfig.provider, 
          hasApiKey: !!aiConfig.apiKey,
          apiKeyLength: aiConfig.apiKey?.length || 0,
          model: aiConfig.model 
        });
        setParserJSON(t('core:convertingToJSON') || 'Converting to JSON...');
        
        // Include links in the text sent to AI
        const textWithLinks = formattedText;
        
        // Use LangChain to process with configured AI provider
        const prompt = `Convert the following text into a structured JSON format. Extract key information, entities, and organize it logically:\n\n${textWithLinks}`;
        
        // Ensure we have a valid config with API key
        if (!aiConfig.apiKey || aiConfig.apiKey.trim().length === 0) {
          throw new Error('API key is missing from configuration');
        }
        
        const jsonResult = Pro?.OpenAI?.convertToJSON
          ? await Pro.OpenAI.convertToJSON(textWithLinks)
          : await processTextWithAI(prompt, {
              ...aiConfig,
              apiKey: aiConfig.apiKey.trim(), // Ensure trimmed
            });
        
        console.log('JSON conversion completed');
        setParserJSON(jsonResult);
        
        // Validate JSON structure
        try {
          JSON.parse(jsonResult);
          console.log('JSON validation successful');
        } catch (parseError) {
          console.warn('Generated JSON may have formatting issues:', parseError);
          // Keep the JSON even if validation fails - it might still be useful
        }
      } catch (aiError) {
        console.error('AI conversion failed:', aiError);
        const errorMsg = aiError instanceof Error ? aiError.message : 'Unknown error';
        const detailedError = errorMsg.includes('API key') 
          ? 'Invalid API key. Please check your API key in Settings > AI.'
          : errorMsg.includes('rate limit') || errorMsg.includes('quota')
          ? 'API rate limit exceeded. Please try again later.'
          : errorMsg.includes('network') || errorMsg.includes('fetch')
          ? 'Network error. Please check your internet connection.'
          : errorMsg;
        setParserJSON(t('core:aiConversionFailed') || 'AI conversion failed: ' + detailedError);
        showNotification(
          t('core:aiConversionFailed') || 'AI conversion failed: ' + detailedError,
          'error'
        );
      }
    } else {
      const noConversionReason = !aiConfig || !aiConfigValid
        ? t('core:aiNotConfigured') || 'AI not configured'
        : 'No text content extracted';
      console.log(noConversionReason);
      setParserJSON(noConversionReason);
    }

    if (!parserOpen) {
      setParserOpen(true);
    }
  } catch (err) {
    console.error('Error parsing PDF:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    showNotification(`${t('core:pdfParseFailed')}: ${errorMessage}` || `PDF parse failed: ${errorMessage}`);
    setParserText(`${t('core:pdfParseFailed')}: ${errorMessage}` || `PDF parse failed: ${errorMessage}`);
  } finally {
    console.log('PDF parsing process completed');
    setParserLoading(false);
    setParseProgress(0);
  }
}, [location, openedEntry, pageRange, parserLoading, parserOpen, Pro, showNotification, t, aiConfig, aiConfigValid, aiConfigLoading, openSettingsDialog]);

  const handleSaveToDb = useCallback(async () => {
    if (!openedEntry?.path || !parserText || !parserJSON) {
      showNotification(t('core:noDataToSave') || 'No data to save');
      return;
    }

    try {
      const fileName = openedEntry.name || 'unknown.pdf';
      const result = await savePdfData(
        openedEntry.path,
        fileName,
        parserText,
        parserJSON,
      );

      if (result.success) {
        setIsDataSaved(true);
        showNotification(t('core:dataSavedToDb') || 'Data saved to database');
        // Re-check to ensure state is updated
        checkPdfDataExists(openedEntry.path).then((exists) => {
          setIsDataSaved(exists);
        });
      } else {
        showNotification(
          t('core:saveToDbFailed') || 'Failed to save: ' + (result.message || 'Unknown error'),
        );
      }
    } catch (error) {
      console.error('Error saving to database:', error);
      showNotification(
        t('core:saveToDbFailed') || 'Failed to save to database',
      );
    }
  }, [openedEntry, parserText, parserJSON, showNotification, t]);

  const handleLoadFromDb = useCallback(async () => {
    if (!openedEntry?.path) {
      showNotification(t('core:noFileSelected') || 'No file selected');
      return;
    }

    setLoadingFromDb(true);
    try {
      const result = await loadPdfData(openedEntry.path);

      if (result.success && result.data) {
        setParserText(result.data.parsed_text || '');
        setParserJSON(result.data.parsed_json || '');
        // Try to extract links from the text if they were saved
        const text = result.data.parsed_text || '';
        const linksMatch = text.match(/--- Extracted Links ---\n([\s\S]*?)(?=\n\n|$)/);
        if (linksMatch) {
          const linksText = linksMatch[1];
          const links: Array<{url: string; text: string}> = [];
          linksText.split('\n').forEach(line => {
            const match = line.match(/^(.+?):\s*(.+)$/);
            if (match) {
              links.push({ text: match[1].trim(), url: match[2].trim() });
            }
          });
          setParserLinks(links);
        } else {
          setParserLinks([]);
        }
        showNotification(t('core:dataLoadedFromDb') || 'Data loaded from database');
        if (!parserOpen) {
          setParserOpen(true);
        }
      } else {
        showNotification(
          t('core:noDataInDb') || 'No data found in database',
        );
      }
    } catch (error) {
      console.error('Error loading from database:', error);
      showNotification(
        t('core:loadFromDbFailed') || 'Failed to load from database',
      );
    } finally {
      setLoadingFromDb(false);
    }
  }, [openedEntry, parserOpen, showNotification, t]);

  useEffect(() => {
    if (editName === entryName && fileNameRef.current) {
      fileNameRef.current.focus();
    }
  }, [editName, entryName]);

  const renameEntry = useCallback(() => {
    if (editName !== undefined && openedEntry) {
      const dirSeparator = location?.getDirSeparator();
      const path = extractContainingDirectoryPath(
        openedEntry.path,
        dirSeparator,
      );
      const nextPath =
        (path && path !== dirSeparator ? path + dirSeparator : '') + editName;

      if (openedEntry.isFile) {
        renameFile(openedEntry.path, nextPath, openedEntry.locationID).catch(
          () => {
            if (fileNameRef.current) fileNameRef.current.value = entryName;
          },
        );
      } else {
        renameDirectory(
          openedEntry.path,
          editName,
          openedEntry.locationID,
        ).catch(() => {
          if (fileNameRef.current) fileNameRef.current.value = entryName;
        });
      }
      setEditName(undefined);
    }
  }, [editName, openedEntry, location, entryName, renameFile, renameDirectory]);

  const activateEditNameField = useCallback(() => {
    if (location?.isReadOnly) {
      setEditName(undefined);
      return;
    }
    setEditName(entryName);
  }, [location, entryName]);

  const deactivateEditNameField = useCallback(() => {
    setEditName(undefined);
    fileNameError.current = false;
    if (fileNameRef.current) {
      fileNameRef.current.value = entryName;
    }
  }, [entryName]);

  const toggleMoveCopyFilesDialog = useCallback(() => {
    if (openedEntry) {
      openMoveCopyFilesDialog([
        {
          ...openedEntry,
          isFile: openedEntry.isFile,
          name: entryName,
          tags: [],
        },
      ]);
    }
  }, [openMoveCopyFilesDialog, openedEntry, entryName]);

  const openThumbFilesDialog = useCallback(() => {
    if (!Pro) {
      showNotification(t('core:thisFunctionalityIsAvailableInPro'));
      return true;
    }
    if (!isEditMode && editName === undefined && thumbDialogContext) {
      thumbDialogContext.openThumbsDialog(openedEntry);
    }
  }, [
    Pro,
    showNotification,
    t,
    isEditMode,
    editName,
    thumbDialogContext,
    openedEntry,
  ]);

  const openBgndImgDialog = useCallback(() => {
    if (!Pro) {
      showNotification(t('core:thisFunctionalityIsAvailableInPro'));
      return true;
    }
    if (!isEditMode && editName === undefined && bgndDialogContext) {
      bgndDialogContext.openBgndDialog(openedEntry);
    }
  }, [
    Pro,
    showNotification,
    t,
    isEditMode,
    editName,
    bgndDialogContext,
    openedEntry,
  ]);

  const fileSize = useCallback(() => {
    if (openedEntry?.isFile) {
      return formatBytes(openedEntry.size);
    } else if (dirProps.current) {
      return formatBytes(dirProps.current.totalSize);
    }
    return t(location?.haveObjectStoreSupport() ? 'core:notAvailable' : '?');
  }, [openedEntry, t, location]);

  const toggleBackgroundColorPicker = useCallback(() => {
    if (location?.isReadOnly) return;
    if (!Pro) {
      showNotification(t('core:thisFunctionalityIsAvailableInPro'));
      return;
    }
    setDisplayColorPicker((prev) => !prev);
  }, [location, Pro, showNotification, t]);

  const handleChangeColor = useCallback(
    (color) => {
      if (color === 'transparent0') color = 'transparent';
      setBackgroundColorChange(openedEntry, color).then((success) => {
        if (success && openedEntry) {
          openedEntry.meta = { ...openedEntry.meta, color };
        }
      });
    },
    [openedEntry, setBackgroundColorChange],
  );

  const handleFileNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value, name } = event.target;
      if (name === 'name') {
        const initValid = disableConfirmButton.current;
        let noValid;
        if (openedEntry.isFile) {
          noValid = fileNameValidation(value);
        } else {
          noValid = dirNameValidation(value);
        }
        disableConfirmButton.current = noValid;
        if (noValid || initValid !== noValid) {
          fileNameError.current = noValid;
        }
        setEditName(value);
      }
    },
    [openedEntry],
  );

  const handleChange = useCallback(
    (name: string, value: Array<TS.Tag>, action: string) => {
      if (openedEntry && fileChanged) {
        showNotification(
          `You can't edit tags, because '${openedEntry.path}' is opened for editing`,
          'default',
          true,
        );
        return;
      }
      if (action === 'remove-value') {
        if (!value) {
          return removeTagsFromEntry(openedEntry);
        } else {
          return removeTagsFromEntry(openedEntry, value);
        }
      } else if (action === 'clear') {
        return removeTagsFromEntry(openedEntry);
      }
      // create-option or select-option
      const tags =
        openedEntry.tags === undefined
          ? value
          : value.filter(
              (tag) => !openedEntry.tags.some((obj) => obj.title === tag.title),
            );
      return addTagsToFsEntry(openedEntry, tags);
    },
    [
      openedEntry,
      fileChanged,
      showNotification,
      removeTagsFromEntry,
      addTagsToFsEntry,
    ],
  );

  if (!openedEntry || !openedEntry.path || openedEntry.path === '') {
    return <div />;
  }

  const ldtm = openedEntry.lmdt ? formatTimestampLocal(openedEntry.lmdt) : ' ';
  const cdt = openedEntry.cdt
    ? formatTimestampLocal(openedEntry.cdt)
    : undefined;

  const fileExt = extractFileExtension(
    openedEntry.path,
    location?.getDirSeparator(),
  ).toLowerCase();
  const docLikeExts = ['doc', 'docx', 'odt', 'rtf'];

  const changePerspective = useCallback(
    (event: any) => {
      const perspective = event.target.value;
      openedEntry.meta = {
        ...(openedEntry.meta && openedEntry.meta),
        perspective,
      };
      saveDirectoryPerspective(
        openedEntry,
        perspective,
        openedEntry.locationID,
      );
    },
    [openedEntry, saveDirectoryPerspective],
  );

  let perspectiveDefault = openedEntry.meta?.perspective || 'unspecified';

  // https://github.com/Leaflet/Leaflet/blob/main/src/layer/marker/Icon.Default.js#L22
  const iconFileMarker = useMemo(
    () =>
      new L.Icon({
        iconUrl: MarkerIcon,
        iconRetinaUrl: Marker2xIcon,
        shadowUrl: MarkerShadowIcon,
        tooltipAnchor: [16, -28],
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41], // point of the icon which will correspond to marker's location
        shadowAnchor: [5, 41],
        popupAnchor: [1, -34], // point from which the popup should open relative to the iconAnchor
      }),
    [],
  );

  function getGeoLocation(tags: Array<TS.Tag>) {
    if (!Pro) return;
    if (tags) {
      for (let i = 0; i < tags.length; i += 1) {
        const location = parseGeoLocation(tags[i].title);
        if (location !== undefined) {
          return location;
        }
      }
    }
  }

  const geoLocation: any = getGeoLocation(
    openedEntry.isFile ? openedEntry.tags : openedEntry.meta?.tags,
  );

  const isCloudLocation = openedEntry.url && openedEntry.url.length > 5;
  const showLinkForDownloading =
    isCloudLocation && openedEntry.isFile && !openedEntry.isEncrypted;

  // --- RENDER ---
  return (
    <div>
      <Grid container>
        <Grid size={12}>
          <TsTextField
            error={fileNameError.current}
            title={isEditMode && t('core:renameDisableTooltip')}
            label={
              openedEntry.isFile ? t('core:fileName') : t('core:folderName')
            }
            slotProps={{
              input: {
                readOnly: editName === undefined,
                endAdornment: (
                  <InputAdornment position="end">
                    {!location.isReadOnly && !isEditMode && (
                      <Box sx={{ textAlign: 'right' }}>
                        {editName !== undefined ? (
                          <>
                            <TsButton
                              data-tid="cancelRenameEntryTID"
                              onClick={deactivateEditNameField}
                              variant="text"
                            >
                              {t('core:cancel')}
                            </TsButton>
                            <TsButton
                              data-tid="confirmRenameEntryTID"
                              onClick={renameEntry}
                              variant="text"
                              disabled={disableConfirmButton.current}
                            >
                              {t('core:confirmSaveButton')}
                            </TsButton>
                          </>
                        ) : (
                          <TsButton
                            data-tid="startRenameEntryTID"
                            variant="text"
                            onClick={activateEditNameField}
                          >
                            {t('core:rename')}
                          </TsButton>
                        )}
                      </Box>
                    )}
                  </InputAdornment>
                ),
              },
            }}
            name="name"
            data-tid="fileNameProperties"
            defaultValue={entryName}
            inputRef={fileNameRef}
            retrieveValue={() => fileNameRef.current.value}
            onClick={() => {
              if (!isEditMode && editName === undefined) {
                activateEditNameField();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !fileNameError.current) {
                renameEntry();
              }
            }}
            onChange={handleFileNameChange}
          />
          {fileNameError.current && (
            <FormHelperText sx={{ marginTop: 0 }}>
              {t(
                'core:' +
                  (openedEntry.isFile ? 'fileNameHelp' : 'directoryNameHelp'),
              )}
            </FormHelperText>
          )}
        </Grid>
        <Grid size={12}>
          <TagDropContainer entry={openedEntry}>
            <TagsSelect
              label={t('core:fileTags')}
              dataTid="PropertiesTagsSelectTID"
              placeholderText={t('core:dropHere')}
              tags={getAllTags(openedEntry, tagDelimiter)}
              tagMode="default"
              handleChange={handleChange}
              selectedEntry={openedEntry}
              autoFocus={true}
              generateButton={true}
            />
          </TagDropContainer>
        </Grid>

        {geoLocation && (
          <Grid size={12}>
            <MapContainer
              style={{
                height: '200px',
                width: '99%',
                margin: 2,
                marginTop: 8,
                borderRadius: AppConfig.defaultCSSRadius,
              }}
              doubleClickZoom={true}
              keyboard={false}
              dragging={true}
              center={geoLocation}
              zoom={13}
              scrollWheelZoom={false}
              zoomControl={true}
              attributionControl={false}
            >
              {tileServer ? (
                <TileLayer
                  attribution={tileServer.serverInfo}
                  url={tileServer.serverURL}
                />
              ) : (
                <NoTileServer />
              )}
              <LayerGroup>
                <Marker
                  icon={iconFileMarker}
                  position={[geoLocation.lat, geoLocation.lng]}
                >
                  <Popup>
                    <Typography
                      sx={{ margin: 0, color: theme.palette.text.primary }}
                    >
                      {t('core:lat') + ' : ' + geoLocation.lat}
                      <br />
                      {t('core:lat') + ' : ' + geoLocation.lng}
                    </Typography>
                    <br />
                    <p>
                      <TsButton
                        onClick={() => {
                          openUrl(
                            'https://www.openstreetmap.org/?mlat=' +
                              geoLocation.lat +
                              '&mlon=' +
                              geoLocation.lng +
                              '#map=14/' +
                              geoLocation.lat +
                              '/' +
                              geoLocation.lng,
                          );
                        }}
                        title="Open in OpenStreetMap"
                      >
                        Open in
                        <br />
                        OpenStreetMap
                      </TsButton>
                      <TsButton
                        sx={{
                          marginLeft: AppConfig.defaultSpaceBetweenButtons,
                        }}
                        onClick={() => {
                          openUrl(
                            'https://maps.google.com/?q=' +
                              geoLocation.lat +
                              ',' +
                              geoLocation.lng +
                              '&ll=' +
                              geoLocation.lat +
                              ',' +
                              geoLocation.lng +
                              '&z=15',
                          );
                        }}
                      >
                        Open in
                        <br />
                        Google Maps
                      </TsButton>
                    </p>
                  </Popup>
                </Marker>
              </LayerGroup>
              <AttributionControl position="bottomright" prefix="" />
            </MapContainer>
          </Grid>
        )}

        <Grid size={12}>
          <TsTextField
            value={ldtm}
            label={t('core:fileLDTM')}
            retrieveValue={() => ldtm}
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        {AppConfig.isElectron && cdt && (
          <Grid size={12}>
            <TsTextField
              value={cdt}
              label={t('core:creationDate')}
              retrieveValue={() => cdt}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
        )}

        <Grid size={12}>
          <Tooltip
            title={
              !location?.haveObjectStoreSupport() &&
              dirProps.current &&
              !openedEntry.isFile &&
              dirProps.current.dirsCount +
                ' ' +
                t('core:directories') +
                ', ' +
                dirProps.current.filesCount +
                ' ' +
                t('core:files')
            }
          >
            <TsTextField
              value={fileSize()}
              retrieveValue={() => fileSize()}
              label={t('core:fileSize')}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SizeIcon />
                    </InputAdornment>
                  ),
                  ...(!openedEntry.isFile && {
                    endAdornment: (
                      <TsButton
                        variant="text"
                        onClick={() =>
                          getOpenedDirProps().then((props) => {
                            dirProps.current = props;
                            forceUpdate();
                          })
                        }
                      >
                        {t('core:calculate')}
                      </TsButton>
                    ),
                  }),
                },
              }}
            />
          </Tooltip>
        </Grid>

        <Grid size={12}>
          <FormControl fullWidth={true}>
            <TsTextField
              name="path"
              title={openedEntry.url || openedEntry.path}
              label={isCloudLocation ? t('cloudPath') : t('core:filePath')}
              data-tid="filePathProperties"
              value={openedEntry.path || ''}
              retrieveValue={() => openedEntry.path}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      {isCloudLocation ? (
                        <CloudLocationIcon
                          sx={{ color: theme.palette.text.secondary }}
                        />
                      ) : (
                        <LocalLocationIcon
                          sx={{ color: theme.palette.text.secondary }}
                        />
                      )}
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {!location.isReadOnly &&
                        !isEditMode &&
                        editName === undefined && (
                          <>
                            <TsButton
                              data-tid="moveCopyEntryTID"
                              onClick={toggleMoveCopyFilesDialog}
                              variant="text"
                            >
                              {t('core:moveFile')}
                            </TsButton>
                            {(fileExt === 'pdf' || docLikeExts.includes(fileExt)) && (
                              <>
                                <TsButton
                                  data-tid="parsePdfTID"
                                  onClick={handleParsePdf}
                                  variant="text"
                                  disabled={parserLoading}
                                  sx={{ marginLeft: '8px' }}
                                >
                                  {parserLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
                                      <span>{t('core:parsing') || 'Parsing...'}</span>
                                    </Box>
                                  ) : (
                                    // Use a different label for docs
                                    docLikeExts.includes(fileExt)
                                      ? t('core:parseDoc') || 'Parse Document'
                                      : t('core:parsePdf') || 'Parse PDF'
                                  )}
                                </TsButton>

                                {/* Show Connect button when AI not configured */}
                                {(!aiConfig || !aiConfigValid || !aiConfig.apiKey || aiConfig.apiKey.trim().length === 0) && (
                                  <TsButton
                                    data-tid="connectAiTID"
                                    onClick={() => {
                                      openSettingsDialog(SettingsTab.AI);
                                      // After opening settings dialog, dispatch redirect event so SettingsAI can show redirect modal
                                      // Use a short timeout to allow the settings component to mount and register its listener
                                      setTimeout(() => {
                                        try {
                                          const feature = fileExt === 'pdf' ? 'pdf' : 'doc';
                                          window.dispatchEvent(new CustomEvent(REDIRECT_TO_AI_SETTINGS_EVENT, { detail: { feature } }));
                                        } catch (e) {
                                          // ignore
                                        }
                                      }, 120);
                                    }}
                                    variant="contained"
                                    color="primary"
                                    sx={{ marginLeft: '8px' }}
                                  >
                                    {t('core:connectAi') || 'Connect AI'}
                                  </TsButton>
                                )}

                                <TsButton
                                  data-tid="showJsonFromDbTID"
                                  onClick={handleLoadFromDb}
                                  variant="text"
                                  disabled={!isDataSaved || loadingFromDb}
                                  sx={{ marginLeft: '8px' }}
                                >
                                  {loadingFromDb ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
                                      <span>{t('core:loading') || 'Loading...'}</span>
                                    </Box>
                                  ) : (
                                    // Keep label same for docs
                                    t('core:showJsonFromDb') || 'Show JSON from DB'
                                  )}
                                </TsButton>
                              </>
                            )}
                          </>
                        )}
                    </InputAdornment>
                  ),
                },
              }}
            />
          </FormControl>
        </Grid>

        <Grid size={12}>
          <TsTextField
            data-tid="sharingLinkTID"
            name="sharinglink"
            label={<>{t('core:sharingLink')}</>}
            value={sharingLink}
            inputRef={sharingLinkRef}
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <OpenLinkIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <TsButton
                      tooltip={t('core:copyLinkToClipboard')}
                      data-tid="copyLinkToClipboardTID"
                      variant="text"
                      onClick={() => {
                        const entryTitle = extractTitle(
                          openedEntry.name,
                          !openedEntry.isFile,
                          location?.getDirSeparator(),
                        );
                        const clibboardItem = generateClipboardLink(
                          sharingLink,
                          entryTitle,
                        );
                        const promise =
                          navigator.clipboard.write(clibboardItem);
                        showNotification(t('core:linkCopied'));
                      }}
                    >
                      {t('core:copy')}
                    </TsButton>
                    <InfoIcon tooltip={t('core:sharingLinkTooltip')} />
                  </InputAdornment>
                ),
              },
            }}
          />
          {showLinkForDownloading && (
            <Grid size={12}>
              <TsTextField
                name="downloadLink"
                label={<>{t('core:downloadLink')}</>}
                value={' '}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <TsButton
                          tooltip={t('core:generateDownloadLink')}
                          onClick={() => setShowSharingLinkDialog(true)}
                          variant="text"
                        >
                          {t('core:generateDownloadLink')}
                        </TsButton>
                        <InfoIcon tooltip={t('core:downloadLinkTooltip')} />
                      </InputAdornment>
                    ),
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeIcon />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
          )}
        </Grid>

        {!openedEntry.isFile && (
          <Grid size={12}>
            <PerspectiveSelector
              onChange={changePerspective}
              defaultValue={perspectiveDefault}
              label={t('core:choosePerspective')}
              testId="changePerspectiveTID"
            />
          </Grid>
        )}
        {!openedEntry.isFile && (
          <Grid size={12} sx={{ marginTop: '5px' }}>
            <TsTextField
              name="path"
              label={<>{t('core:backgroundColor')}</>}
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <TransparentBackground>
                        <TsButton
                          tooltip={t('editBackgroundColor')}
                          fullWidth
                          sx={{
                            width: 160,
                            height: 25,
                            background: openedEntry.meta?.color,
                            border: '1px solid lightgray',
                          }}
                          onClick={toggleBackgroundColorPicker}
                        >
                          &nbsp;
                        </TsButton>
                      </TransparentBackground>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Box>
                        <ProTooltip tooltip={t('changeBackgroundColor')}>
                          <TsIconButton
                            data-tid="changeBackgroundColorTID"
                            aria-describedby={popoverId}
                            onClick={handlePopoverClick}
                            disabled={!Pro}
                          >
                            <ColorPaletteIcon />
                          </TsIconButton>
                        </ProTooltip>
                        <Popover
                          open={popoverOpen}
                          onClose={handlePopoverClose}
                          anchorEl={popoverAnchorEl}
                          id={popoverId}
                          anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'center',
                          }}
                          transformOrigin={{
                            vertical: 'bottom',
                            horizontal: 'center',
                          }}
                        >
                          <Box sx={{ padding: '10px' }}>
                            {defaultBackgrounds.map((background, cnt) => (
                              <>
                                <TsIconButton
                                  key={cnt}
                                  data-tid={'backgroundTID' + cnt}
                                  aria-label="changeFolderBackround"
                                  onClick={() => {
                                    handleChangeColor(background);
                                    handlePopoverClose();
                                  }}
                                  sx={{
                                    backgroundColor: background,
                                    backgroundImage: background,
                                    margin: '5px',
                                  }}
                                >
                                  <SetColorIcon />
                                </TsIconButton>
                                {cnt % 4 === 3 && <br />}
                              </>
                            ))}
                          </Box>
                        </Popover>
                      </Box>
                      {openedEntry.meta && openedEntry.meta.color && (
                        <>
                          <ProTooltip tooltip={t('clearFolderColor')}>
                            <TsIconButton
                              data-tid={'backgroundClearTID'}
                              disabled={!Pro}
                              aria-label="clear"
                              onClick={() =>
                                openConfirmDialog(
                                  t('core:confirm'),
                                  t('core:confirmResetColor'),
                                  (result) => {
                                    if (result) {
                                      handleChangeColor('transparent');
                                    }
                                  },
                                  'cancelConfirmResetColorDialog',
                                  'confirmConfirmResetColorDialog',
                                  'confirmResetColorDialogContent',
                                )
                              }
                            >
                              <ClearColorIcon />
                            </TsIconButton>
                          </ProTooltip>
                        </>
                      )}
                      <InfoIcon tooltip={t('core:backgroundColorInfo')} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
        )}
        <Grid container spacing={1} size={12}>
          <Grid size={openedEntry.isFile ? 12 : 6}>
            <FormHelperText>{t('core:thumbnail')}</FormHelperText>
            <ThumbnailTextField
              margin="dense"
              variant="outlined"
              sx={{ marginTop: 0 }}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="end">
                      <Stack
                        direction="column"
                        spacing={0}
                        sx={{ alignItems: 'center' }}
                      >
                        {!location.isReadOnly &&
                          !isEditMode &&
                          editName === undefined && (
                            <ProTooltip tooltip={t('changeThumbnail')}>
                              <TsButton
                                data-tid="changeThumbnailTID"
                                fullWidth
                                variant="text"
                                onClick={openThumbFilesDialog}
                              >
                                {t('core:change')}
                              </TsButton>
                            </ProTooltip>
                          )}
                        <Box
                          role="button"
                          tabIndex={0}
                          sx={{
                            backgroundSize: 'cover',
                            backgroundRepeat: 'no-repeat',
                            backgroundImage: thumbImage.current,
                            backgroundPosition: 'center',
                            borderRadius: AppConfig.defaultCSSRadius,
                            minHeight: 150,
                            minWidth: 150,
                            marginBottom: '5px',
                          }}
                          onClick={openThumbFilesDialog}
                        />
                      </Stack>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          {!openedEntry.isFile && (
            <Grid size={6}>
              <FormHelperText>{t('core:backgroundImage')}</FormHelperText>
              <ThumbnailTextField
                margin="dense"
                fullWidth
                sx={{
                  marginTop: 0,
                }}
                variant="outlined"
                slotProps={{
                  input: {
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="end">
                        <Stack
                          direction="column"
                          spacing={0}
                          sx={{ alignItems: 'center' }}
                        >
                          {!location.isReadOnly &&
                            !isEditMode &&
                            editName === undefined && (
                              <ProTooltip tooltip={t('changeBackgroundImage')}>
                                <TsButton
                                  data-tid="changeBackgroundImageTID"
                                  fullWidth
                                  variant="text"
                                  onClick={openBgndImgDialog}
                                >
                                  {t('core:change')}
                                </TsButton>
                              </ProTooltip>
                            )}
                          <Box
                            data-tid="propsBgnImageTID"
                            role="button"
                            tabIndex={0}
                            sx={{
                              backgroundSize: 'cover',
                              backgroundRepeat: 'no-repeat',
                              backgroundImage: backgroundImage.current,
                              backgroundPosition: 'center',
                              borderRadius: AppConfig.defaultCSSRadius,
                              minHeight: 150,
                              minWidth: 150,
                              marginBottom: '5px',
                            }}
                            onClick={openBgndImgDialog}
                          />
                        </Stack>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
          )}
        </Grid>
        <Grid size={12}>
          <TsTextField
            data-tid="entryIDTID"
            name="entryid"
            label={t('core:entryId')}
            value={openedEntry?.meta?.id}
            retrieveValue={() => openedEntry?.meta?.id}
            slotProps={{
              input: {
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <IDIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <TsButton
                      tooltip={t('core:copyIdToClipboard')}
                      data-tid="copyIdToClipboardTID"
                      variant="text"
                      disabled={!openedEntry?.meta?.id}
                      onClick={() => {
                        const entryId = openedEntry?.meta?.id;
                        if (entryId) {
                          const clibboardItem = generateClipboardLink(
                            entryId,
                            entryId,
                          );
                          const promise =
                            navigator.clipboard.write(clibboardItem);
                          showNotification(t('core:entryIdCopied'));
                        }
                      }}
                    >
                      {t('core:copy')}
                    </TsButton>
                    <InfoIcon tooltip={t('core:entryIdTooltip')} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>
      </Grid>
      {showSharingLinkDialog && (
        <LinkGeneratorDialog
          open={showSharingLinkDialog}
          onClose={() => setShowSharingLinkDialog(false)}
        />
      )}
      {CustomBackgroundDialog && (
        <CustomBackgroundDialog
          color={openedEntry.meta?.color}
          open={displayColorPicker}
          setColor={handleChangeColor}
          onClose={toggleBackgroundColorPicker}
          currentDirectoryPath={openedEntry.path}
        />
      )}
        {parserOpen && (
        <PDFParserDialog
          open={parserOpen}
          onClose={() => setParserOpen(false)}
          parserLoading={parserLoading}
          parseProgress={parseProgress}
          parserText={parserText}
          parserJSON={parserJSON}
          parserLinks={parserLinks}
          totalPages={totalPages}
          pageRange={pageRange}
          onStartParsing={handleParsePdf}
          onPageRangeChange={setPageRange}
          filePath={openedEntry?.path}
          fileName={openedEntry?.name}
          fileType={fileExt}
          isDataSaved={isDataSaved}
          onSaveToDb={handleSaveToDb}
        />
      )}
    </div>
  );
}

export default React.memo(EntryProperties);
