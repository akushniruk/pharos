import {
  Show,
  onMount,
  onCleanup,
  createSignal,
  createMemo,
  createEffect,
} from 'solid-js';

import {
  selectedProject,
  selectedSession,
  selectedProjectSnapshot,
  selectedSessionSnapshot,
  selectedViewedChangesSnapshot,
  selectedAgent,
  selectProject,
} from '../lib/store';
import { connectWs, fetchMemoryBrainStatus } from '../lib/ws';
import { initTheme } from '../lib/theme';
import { DOCS_PORTAL_SECTIONS, docsPortalEntryTitle } from '../lib/docsPortal';
import { documentationBundleVersionLabel } from '../lib/docsVersion';
import { APP_BROWSER_TITLE } from '../lib/appBranding';
import { friendlyProjectName } from '../lib/projectDisplayName';
import { docContentForPath } from '../lib/docsPortalContent';
import {
  docsPathForSlug,
  docsSlugForPath,
  firstDocsPath,
} from '@features/docs-portal/slugRoutes';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import EventStream from '../components/EventStream';
import AgentGraph from '../components/AgentGraph';
import AgentDetail from '../components/AgentDetail';
import ViewModeTabs from '../components/ViewModeTabs';
import ProjectsHome from '../pages/ProjectsHome';
import DocsReadingGuide from '../widgets/docs-portal/DocsReadingGuide';
import AppStatusBar from '../widgets/AppStatusBar';

type ViewMode = 'logs' | 'graph';
type AppRoute = 'main' | 'docs';
const VIEW_MODE_STORAGE_KEY = 'pharos.view-mode';

function formatBrowserTitle(parts: string[]): string {
  const core = parts.filter(Boolean).join(' · ');
  if (core.length <= 120) return core;
  return `${core.slice(0, 117)}…`;
}

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>('logs');
  const [route, setRoute] = createSignal<AppRoute>('main');
  const [docsQuery, setDocsQuery] = createSignal('');
  const [selectedDocPath, setSelectedDocPath] = createSignal(firstDocsPath());

  const docsPortalSections = createMemo(() => {
    const query = docsQuery().trim().toLowerCase();
    if (!query) return DOCS_PORTAL_SECTIONS;
    return DOCS_PORTAL_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => {
        const haystack = `${entry.title} ${entry.path} ${entry.summary}`.toLowerCase();
        return haystack.includes(query);
      }),
    })).filter((section) => section.entries.length > 0);
  });
  const docsEntryCount = createMemo(() =>
    docsPortalSections().reduce((count, section) => count + section.entries.length, 0),
  );
  const selectedDocContent = createMemo(() => docContentForPath(selectedDocPath()));
  const navigateToPath = (path: string) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === path) return;
    window.history.pushState({}, '', path);
  };

  const syncRouteFromLocation = () => {
    if (typeof window === 'undefined') {
      setRoute('main');
      return;
    }
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const docsByPath = path === '/docs' || path.startsWith('/docs/');
    const docsByHash = hash.startsWith('#/docs');
    const isDocs = docsByPath || docsByHash;
    setRoute(isDocs ? 'docs' : 'main');
    if (!isDocs) return;

    const pathParts = window.location.pathname.replace(/^\/+/, '').split('/');
    const hashParts = window.location.hash.replace(/^#\/?/, '').split('/');
    const slugFromPath = pathParts[0] === 'docs' ? decodeURIComponent(pathParts[1] ?? '') : '';
    const slugFromHash = hashParts[0] === 'docs' ? decodeURIComponent(hashParts[1] ?? '') : '';
    let slug = slugFromPath || slugFromHash;
    if (!slug) {
      const defaultPath = firstDocsPath();
      const defaultSlug = docsSlugForPath(defaultPath);
      setSelectedDocPath(defaultPath);
      if (docsByPath) {
        navigateToPath(`/docs/${encodeURIComponent(defaultSlug)}`);
      } else if (docsByHash) {
        window.location.hash = `#/docs/${encodeURIComponent(defaultSlug)}`;
      }
      return;
    }
    const resolved = docsPathForSlug(slug);
    if (resolved && resolved !== selectedDocPath()) {
      setSelectedDocPath(resolved);
    }
  };

  const navigateHome = () => {
    navigateToPath('/');
    setRoute('main');
    selectProject(null);
  };

  const navigateDocs = () => {
    const slug = docsSlugForPath(selectedDocPath());
    navigateToPath(`/docs/${encodeURIComponent(slug)}`);
    setRoute('docs');
  };

  const selectDocsDocument = (path: string, fragment?: string) => {
    setSelectedDocPath(path);
    const slug = docsSlugForPath(path);
    const targetPath = `/docs/${encodeURIComponent(slug)}`;
    if (typeof window !== 'undefined') {
      const next = fragment ? `${targetPath}#${fragment}` : targetPath;
      if (`${window.location.pathname}${window.location.hash}` !== next) {
        window.history.pushState({}, '', next);
      }
    }
    setRoute('docs');
    if (fragment) {
      requestAnimationFrame(() => {
        document.getElementById(fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY)?.trim();
      if (raw === 'logs' || raw === 'graph') {
        setViewMode(raw);
      }
    }
    connectWs();
    void fetchMemoryBrainStatus();
    initTheme();
    syncRouteFromLocation();
    const onHashChange = () => syncRouteFromLocation();
    const onPopState = () => syncRouteFromLocation();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    onCleanup(() => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    });
  });

  createEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode());
  });

  createEffect(() => {
    if (typeof document === 'undefined') return;
    const app = APP_BROWSER_TITLE;
    if (route() === 'docs') {
      const docName = docsPortalEntryTitle(selectedDocPath()) ?? 'Documentation';
      const docsLabel = `Docs ${documentationBundleVersionLabel()}`;
      document.title = formatBrowserTitle([docName, docsLabel, app]);
      return;
    }
    const project = selectedProjectSnapshot();
    if (!project) {
      document.title = formatBrowserTitle(['Home', app]);
      return;
    }
    const session = selectedSessionSnapshot();
    const sessionLabel = session?.label?.trim();
    const projectTitle = friendlyProjectName(project.name);
    if (sessionLabel) {
      document.title = formatBrowserTitle([sessionLabel, projectTitle, app]);
    } else {
      document.title = formatBrowserTitle([projectTitle, app]);
    }
  });

  /** Sidebar scope changes should show the stream; graph would otherwise stay visible from localStorage. */
  const prevSidebarScope = { project: null as string | null, session: null as string | null };
  createEffect(() => {
    const proj = selectedProject();
    const sess = selectedSession();
    const prev = prevSidebarScope;
    const enteredProject = proj !== null && proj !== prev.project;
    const focusedSession = proj !== null && sess !== null && sess !== prev.session;
    if (enteredProject || focusedSession) {
      setViewMode('logs');
    }
    prev.project = proj;
    prev.session = sess;
  });

  createEffect(() => {
    const current = selectedDocPath();
    const existsInFilter = docsPortalSections().some((section) =>
      section.entries.some((entry) => entry.path === current),
    );
    if (!existsInFilter) {
      const first = docsPortalSections()[0]?.entries[0]?.path;
      if (first) setSelectedDocPath(first);
    }
  });

  /** Avoid nested `<Show fallback>` for main panel — that pattern can miss `selectedProject()` updates. */
  const mainPanel = createMemo((): 'docs' | 'home' | 'workspace' => {
    if (route() === 'docs') return 'docs';
    return selectedProject() ? 'workspace' : 'home';
  });

  const projectWorkspaceBody = createMemo(() => {
    if (viewMode() === 'logs') {
      return (
        <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <EventStream viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      );
    }
    return (
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <AgentGraph />
        <Show when={selectedAgent()}>
          <div class="w-[300px] shrink-0 overflow-y-auto border-l border-[var(--border)]">
            <AgentDetail />
          </div>
        </Show>
      </div>
    );
  });

  const mainAreaContent = createMemo(() => {
    if (mainPanel() === 'docs') {
      return (
        <div class="docs-route-main">
          <DocsReadingGuide
            selectedDocPath={selectedDocPath()}
            selectedDocContent={selectedDocContent()}
            onSelectDocPath={selectDocsDocument}
          />
        </div>
      );
    }
    if (mainPanel() === 'home') {
      return <ProjectsHome />;
    }
    return (
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Show when={viewMode() === 'graph'}>
          <div class="event-stream-toolbar relative z-30 shrink-0">
            <ViewModeTabs viewMode={viewMode} onChange={setViewMode} />
          </div>
        </Show>
        {projectWorkspaceBody()}
      </div>
    );
  });

  return (
    <div class="app">
      <Header
        isDocsRoute={route() === 'docs'}
        onNavigateHome={navigateHome}
        onNavigateDocs={navigateDocs}
      />

      <div class="app-body">
        <Show
          when={route() === 'docs'}
          fallback={
            <Sidebar
              collapsed={sidebarCollapsed()}
              onToggle={() => setSidebarCollapsed((c) => !c)}
              onEnsureLogsView={() => setViewMode('logs')}
            />
          }
        >
          <Sidebar
            collapsed={sidebarCollapsed()}
            isDocsRoute
            docsQuery={docsQuery()}
            onDocsQueryChange={setDocsQuery}
            docsEntryCount={docsEntryCount()}
            docsSections={docsPortalSections()}
            selectedDocPath={selectedDocPath()}
            onSelectDoc={selectDocsDocument}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        </Show>

        <div class="app-main">{mainAreaContent()}</div>
      </div>

      <AppStatusBar />
    </div>
  );
}
