import clientPackage from '../../package.json';

/**
 * Semantic version of the bundled dashboard (and thus this in-app documentation
 * set). Kept in sync with `apps/client-solid/package.json` at build time.
 */
export const DOCUMENTATION_BUNDLE_VERSION: string = clientPackage.version;

/** Display label for UI chrome (e.g. `v0.1.0`). */
export function documentationBundleVersionLabel(): string {
  const v = DOCUMENTATION_BUNDLE_VERSION.trim();
  return v.startsWith('v') ? v : `v${v}`;
}
