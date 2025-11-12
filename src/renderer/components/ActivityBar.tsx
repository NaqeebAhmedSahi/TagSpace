import React from 'react';
import { Box, IconButton, Tooltip, Stack } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import LabelIcon from '@mui/icons-material/Label';
import StorageIcon from '@mui/icons-material/Storage';

interface ActivityBarProps {
  className?: string;
  onHome?: () => void;
  onSearch?: () => void;
  onFolders?: () => void;
  onTags?: () => void;
  onSettings?: () => void;
  onDatabase?: () => void;
}

function ActivityBar({
  className,
  onHome,
  onSearch,
  onFolders,
  onTags,
  onSettings,
  onDatabase,
}: ActivityBarProps) {
  return (
    <Box
      className={className}
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '56px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
        borderRight: (theme) => `1px solid ${theme.palette.divider}`,
        zIndex: 1200,
        paddingTop: 1,
        paddingBottom: 1,
      }}
    >
      <Stack spacing={1} alignItems="center">
        <Tooltip title="Home">
          <IconButton size="large" color="primary" onClick={onHome}>
            <HomeIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Search">
          <IconButton size="large" color="primary" onClick={onSearch}>
            <SearchIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Folders">
          <IconButton size="large" color="primary" onClick={onFolders}>
            <FolderIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Tags">
          <IconButton size="large" color="primary" onClick={onTags}>
            <LabelIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Database">
          <IconButton size="large" color="primary" onClick={onDatabase}>
            <StorageIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1} alignItems="center">
        <Tooltip title="Settings">
          <IconButton size="large" color="primary" onClick={onSettings}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="About">
          <IconButton size="large" color="primary">
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );

}

ActivityBar.defaultProps = {
  className: undefined,
  onHome: () => {},
  onSearch: () => {},
  onFolders: () => {},
  onTags: () => {},
  onSettings: () => {},
  onDatabase: () => {},
};

export default ActivityBar;
