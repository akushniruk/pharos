/**
 * Core navigation, selection signals, and persisted UI flags.
 * Re-exports a subset of `./state` for layered imports.
 */
export {
  view,
  setView,
  selectedProject,
  setSelectedProject,
  selectedSession,
  setSelectedSession,
  selectedAgent,
  setSelectedAgent,
  helpVisible,
  setHelpVisible,
  viewedScopes,
  setViewedScopes,
  dismissedAttentionBanners,
  setDismissedAttentionBanners,
} from './state';
