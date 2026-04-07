# Trust, data, and local execution

**Tone:** Security-led, auditability first — aligned with [public positioning](https://github.com/akushniruk/pharos/blob/main/docs/positioning.md) in the repository.

## Local-first execution

By default, treat **sensitive execution detail** as staying on the device. Features that sync or upload data should say so explicitly in product copy and release notes.

## Auditability

The MVP observability slice emphasizes **durable, structured local records** tied to control-plane identity when credentials are present. See [The observability slice](/docs/concepts/observability-slice).

## Threat model (summary)

A full threat model belongs in security review materials. For documentation readers: assume **workspace access** implies ability to read local logs and agent configuration on that machine.

## Governance

Continue to [Governance patterns](/docs/security/governance-patterns) for policies, allowlists, and “show your work” defaults as they land in product.
