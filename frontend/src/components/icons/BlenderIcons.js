import React from 'react';
import * as LucideIcons from 'lucide-react';
import { BlenderIcon } from './BlenderIcon';

/**
 * Blender-style icon exports using lucide-react icons
 * All icons are wrapped with Blender styling for consistent appearance
 */

// Re-export BlenderIcon wrapper
export { BlenderIcon };

// Navigation & Controls
export const Play = (props) => <BlenderIcon icon={LucideIcons.Play} {...props} />;
export const Pause = (props) => <BlenderIcon icon={LucideIcons.Pause} {...props} />;
export const Stop = (props) => <BlenderIcon icon={LucideIcons.Square} {...props} />;
export const SkipBack = (props) => <BlenderIcon icon={LucideIcons.SkipBack} {...props} />;
export const SkipForward = (props) => <BlenderIcon icon={LucideIcons.SkipForward} {...props} />;

// Navigation
export const ChevronLeft = (props) => <BlenderIcon icon={LucideIcons.ChevronLeft} {...props} />;
export const ChevronRight = (props) => <BlenderIcon icon={LucideIcons.ChevronRight} {...props} />;
export const ChevronDown = (props) => <BlenderIcon icon={LucideIcons.ChevronDown} {...props} />;
export const ChevronUp = (props) => <BlenderIcon icon={LucideIcons.ChevronUp} {...props} />;

// Actions
export const Plus = (props) => <BlenderIcon icon={LucideIcons.Plus} {...props} />;
export const Minus = (props) => <BlenderIcon icon={LucideIcons.Minus} {...props} />;
export const X = (props) => <BlenderIcon icon={LucideIcons.X} {...props} />;
export const Edit = (props) => <BlenderIcon icon={LucideIcons.Pencil} {...props} />;
export const Trash = (props) => <BlenderIcon icon={LucideIcons.Trash2} {...props} />;
export const Copy = (props) => <BlenderIcon icon={LucideIcons.Copy} {...props} />;
export const Save = (props) => <BlenderIcon icon={LucideIcons.Save} {...props} />;

// Media & Content
export const Music = (props) => <BlenderIcon icon={LucideIcons.Music} {...props} />;
export const Grid = (props) => <BlenderIcon icon={LucideIcons.Grid3x3} {...props} />;
export const LayoutGrid = (props) => <BlenderIcon icon={LucideIcons.LayoutGrid} {...props} />;
export const ListMusic = (props) => <BlenderIcon icon={LucideIcons.ListMusic} {...props} />;

// Tools & Settings
export const ZoomIn = (props) => <BlenderIcon icon={LucideIcons.ZoomIn} {...props} />;
export const ZoomOut = (props) => <BlenderIcon icon={LucideIcons.ZoomOut} {...props} />;
export const Sliders = (props) => <BlenderIcon icon={LucideIcons.Sliders} {...props} />;
export const Palette = (props) => <BlenderIcon icon={LucideIcons.Palette} {...props} />;
export const Home = (props) => <BlenderIcon icon={LucideIcons.Home} {...props} />;
export const GripVertical = (props) => <BlenderIcon icon={LucideIcons.GripVertical} {...props} />;
export const Pencil = (props) => <BlenderIcon icon={LucideIcons.Pencil} {...props} />;
export const Eraser = (props) => <BlenderIcon icon={LucideIcons.Eraser} {...props} />;
export const Magnet = (props) => <BlenderIcon icon={LucideIcons.Magnet} {...props} />;
export const MousePointer2 = (props) => <BlenderIcon icon={LucideIcons.MousePointer2} {...props} />;
export const Link = (props) => <BlenderIcon icon={LucideIcons.Link} {...props} />;
export const Link2 = (props) => <BlenderIcon icon={LucideIcons.Link2} {...props} />;
export const Target = (props) => <BlenderIcon icon={LucideIcons.Target} {...props} />;
export const AlignCenter = (props) => <BlenderIcon icon={LucideIcons.AlignCenter} {...props} />;
export const Volume2 = (props) => <BlenderIcon icon={LucideIcons.Volume2} {...props} />;
export const VolumeX = (props) => <BlenderIcon icon={LucideIcons.VolumeX} {...props} />;
export const Headphones = (props) => <BlenderIcon icon={LucideIcons.Headphones} {...props} />;

// Window Controls
export const Maximize = (props) => <BlenderIcon icon={LucideIcons.Maximize} {...props} />;
export const Minimize = (props) => <BlenderIcon icon={LucideIcons.Minimize2} {...props} />;

// Additional icons as needed
export const FolderTree = (props) => <BlenderIcon icon={LucideIcons.FolderTree} {...props} />;
export const Settings = (props) => <BlenderIcon icon={LucideIcons.Settings} {...props} />;
export const Search = (props) => <BlenderIcon icon={LucideIcons.Search} {...props} />;
export const Filter = (props) => <BlenderIcon icon={LucideIcons.Filter} {...props} />;
export const MoreHorizontal = (props) => <BlenderIcon icon={LucideIcons.MoreHorizontal} {...props} />;
export const MoreVertical = (props) => <BlenderIcon icon={LucideIcons.MoreVertical} {...props} />;
export const RotateCcw = (props) => <BlenderIcon icon={LucideIcons.RotateCcw} {...props} />;

// Export default for convenience
export default {
  Play,
  Pause,
  Stop,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  X,
  Edit,
  Trash,
  Copy,
  Save,
  Music,
  Grid,
  LayoutGrid,
  ListMusic,
  ZoomIn,
  ZoomOut,
  Sliders,
  Palette,
  Home,
  GripVertical,
  Maximize,
  Minimize,
  FolderTree,
  Settings,
  Search,
  Filter,
  MoreHorizontal,
  MoreVertical
};
