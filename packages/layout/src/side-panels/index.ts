export * as SidePanels from './parts'
export { useSidePanels } from './parts'
export type {
  RootProps as SidePanelsRootProps,
  PanelProps as SidePanelsPanelProps,
  MainProps as SidePanelsMainProps,
  ResizeHandleProps as SidePanelsResizeHandleProps,
  HoverTriggerProps as SidePanelsHoverTriggerProps,
  HoverOverlayOptions,
  SidePanelsApi,
} from './parts'
export { getSide, setCollapsed, setSize, toggleCollapsed } from './model'
export type { Side, SideLayout, SidePanelsLayout } from './model'
