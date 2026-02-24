// SylOS Mobile Icon System
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Main navigation icons
export const NavigationIcons = {
  home: 'home-outline' as keyof typeof Ionicons.glyphMap,
  wallet: 'wallet-outline' as keyof typeof Ionicons.glyphMap,
  pop: 'analytics-outline' as keyof typeof Ionicons.glyphMap,
  files: 'folder-outline' as keyof typeof Ionicons.glyphMap,
  tokens: 'trending-up-outline' as keyof typeof Ionicons.glyphMap,
  settings: 'settings-outline' as keyof typeof Ionicons.glyphMap,
};

// Wallet icons
export const WalletIcons = {
  receive: 'arrow-down-outline' as keyof typeof Ionicons.glyphMap,
  send: 'arrow-up-outline' as keyof typeof Ionicons.glyphMap,
  swap: 'swap-horizontal-outline' as keyof typeof Ionicons.glyphMap,
  qr: 'qr-code-outline' as keyof typeof Ionicons.glyphMap,
  scan: 'scan-outline' as keyof typeof Ionicons.glyphMap,
  copy: 'copy-outline' as keyof typeof Ionicons.glyphMap,
  eth: 'logo-ethereum' as keyof typeof Ionicons.glyphMap,
  polygon: 'logo-ethereum' as keyof typeof Ionicons.glyphMap,
  bitcoin: 'logo-bitcoin' as keyof typeof Ionicons.glyphMap,
};

// PoP Tracker icons
export const PoPIcons = {
  task: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
  goal: 'flag-outline' as keyof typeof Ionicons.glyphMap,
  streak: 'flame-outline' as keyof typeof Ionicons.glyphMap,
  trophy: 'trophy-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
  diamond: 'diamond-stone' as keyof typeof MaterialCommunityIcons.glyphMap,
  platinum: 'medal' as keyof typeof MaterialCommunityIcons.glyphMap,
  productivity: 'chart-line' as keyof typeof MaterialCommunityIcons.glyphMap,
  verify: 'shield-check-outline' as keyof typeof Ionicons.glyphMap,
};

// File Manager icons
export const FileIcons = {
  folder: 'folder-outline' as keyof typeof Ionicons.glyphMap,
  document: 'document-outline' as keyof typeof Ionicons.glyphMap,
  image: 'image-outline' as keyof typeof Ionicons.glyphMap,
  video: 'videocam-outline' as keyof typeof Ionicons.glyphMap,
  audio: 'musical-notes-outline' as keyof typeof Ionicons.glyphMap,
  download: 'download-outline' as keyof typeof Ionicons.glyphMap,
  upload: 'cloud-upload-outline' as keyof typeof Ionicons.glyphMap,
  sync: 'sync-outline' as keyof typeof Ionicons.glyphMap,
  ipfs: 'link-outline' as keyof typeof Ionicons.glyphMap,
};

// Security and Settings icons
export const SecurityIcons = {
  lock: 'lock-closed-outline' as keyof typeof Ionicons.glyphMap,
  unlock: 'lock-open-outline' as keyof typeof Ionicons.glyphMap,
  fingerprint: 'finger-print' as keyof typeof Ionicons.glyphMap,
  face: 'eye-outline' as keyof typeof Ionicons.glyphMap,
  key: 'key-outline' as keyof typeof Ionicons.glyphMap,
  shield: 'shield-outline' as keyof typeof Ionicons.glyphMap,
  alert: 'warning-outline' as keyof typeof Ionicons.glyphMap,
};

// General UI icons
export const UIIcons = {
  search: 'search-outline' as keyof typeof Ionicons.glyphMap,
  add: 'add-outline' as keyof typeof Ionicons.glyphMap,
  remove: 'remove-outline' as keyof typeof Ionicons.glyphMap,
  close: 'close-outline' as keyof typeof Ionicons.glyphMap,
  menu: 'menu-outline' as keyof typeof Ionicons.glyphMap,
  more: 'ellipsis-horizontal-outline' as keyof typeof Ionicons.glyphMap,
  back: 'chevron-back-outline' as keyof typeof Ionicons.glyphMap,
  forward: 'chevron-forward-outline' as keyof typeof Ionicons.glyphMap,
  refresh: 'refresh-outline' as keyof typeof Ionicons.glyphMap,
  info: 'information-circle-outline' as keyof typeof Ionicons.glyphMap,
  help: 'help-circle-outline' as keyof typeof Ionicons.glyphMap,
};

// Default icon size
export const IconSize = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

export type IconSizeKeys = keyof typeof IconSize;
