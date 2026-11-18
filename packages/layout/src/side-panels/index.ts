export * as SidePanels from './parts.js'
export { useSidePanels } from './parts.js'
export type {
  RootProps as SidePanelsRootProps,
  PanelProps as SidePanelsPanelProps,
  MainProps as SidePanelsMainProps,
  ResizeHandleProps as SidePanelsResizeHandleProps,
  HoverTriggerProps as SidePanelsHoverTriggerProps,
  HoverOverlayOptions,
  SidePanelsApi,
} from './parts.js'
export { getSide, setCollapsed, setSize, toggleCollapsed } from './model.js'
export type { Side, SideLayout, SidePanelsLayout } from './model.js'
export type { ChangeDetails, ChangeReason, LayoutChangeHandler } from '../internal/controller.js'
