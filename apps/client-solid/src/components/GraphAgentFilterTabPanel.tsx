export type GraphAgentFilter = 'active' | 'idle' | 'all';

export interface GraphAgentFilterTabPanelProps {
  value: GraphAgentFilter;
  onChange: (next: GraphAgentFilter) => void;
  counts: {
    active: number;
    idle: number;
    all: number;
  };
}

const TAB_IDS = {
  active: 'graph-agent-filter-tab-active',
  idle: 'graph-agent-filter-tab-idle',
  all: 'graph-agent-filter-tab-all',
} as const;

const PANEL_ID = 'graph-agent-filter-panel';

export default function GraphAgentFilterTabPanel(props: GraphAgentFilterTabPanelProps) {
  return (
    <div class="graph-agent-filter-tabpanel">
      <div
        class="pill-tabs graph-agent-filter-tabs"
        role="tablist"
        aria-label="Filter agents on graph"
      >
        <button
          id={TAB_IDS.active}
          class="pill-tab event-stream-tab"
          classList={{ 'is-active': props.value === 'active' }}
          type="button"
          role="tab"
          aria-selected={props.value === 'active'}
          aria-controls={PANEL_ID}
          tabIndex={props.value === 'active' ? 0 : -1}
          onClick={() => props.onChange('active')}
        >
          Active ({props.counts.active})
        </button>
        <button
          id={TAB_IDS.idle}
          class="pill-tab event-stream-tab"
          classList={{ 'is-active': props.value === 'idle' }}
          type="button"
          role="tab"
          aria-selected={props.value === 'idle'}
          aria-controls={PANEL_ID}
          tabIndex={props.value === 'idle' ? 0 : -1}
          onClick={() => props.onChange('idle')}
        >
          Idle ({props.counts.idle})
        </button>
        <button
          id={TAB_IDS.all}
          class="pill-tab event-stream-tab"
          classList={{ 'is-active': props.value === 'all' }}
          type="button"
          role="tab"
          aria-selected={props.value === 'all'}
          aria-controls={PANEL_ID}
          tabIndex={props.value === 'all' ? 0 : -1}
          onClick={() => props.onChange('all')}
        >
          All ({props.counts.all})
        </button>
      </div>
    </div>
  );
}

export { PANEL_ID, TAB_IDS };
