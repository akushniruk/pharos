use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! uuid_id {
    ($doc:literal, $name:ident) => {
        #[doc = $doc]
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            #[must_use]
            pub fn new_v4() -> Self {
                Self(Uuid::new_v4())
            }

            #[must_use]
            pub const fn from_uuid(u: Uuid) -> Self {
                Self(u)
            }

            #[must_use]
            pub const fn as_uuid(&self) -> Uuid {
                self.0
            }
        }

        impl std::fmt::Debug for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.debug_tuple(stringify!($name))
                    .field(&self.0.to_string())
                    .finish()
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.0.fmt(f)
            }
        }
    };
}

uuid_id!("Stable agent identity in Pharos / control plane.", AgentId);
uuid_id!("Tenant / organization scope for agents and naming.", OrgId);
uuid_id!("Durable agent-to-agent relationship row.", RelationshipId);
uuid_id!(
    "Workspace / project scope for sessions and runs.",
    WorkspaceId
);
uuid_id!("Operator or shell session grouping runs.", SessionId);
uuid_id!(
    "Pharos-native run record (distinct from control-plane correlation).",
    RunId
);
uuid_id!("Single audit / telemetry event.", EventId);
uuid_id!(
    "Correlates to an upstream heartbeat run (e.g. Paperclip `X-Paperclip-Run-Id`).",
    CorrelationId
);
