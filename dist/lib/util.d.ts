import type { AddOnWithRelatedData } from '@heroku/heroku-cli-util/dist/types/pg/data-api.js';
import type { ConnectionDetailsWithAttachment } from '@heroku/heroku-cli-util/dist/types/pg/tunnel.js';
export declare function ensurePGStatStatement(connectionDetails: ConnectionDetailsWithAttachment): Promise<void>;
export declare function ensureEssentialTierPlan(db: AddOnWithRelatedData): void;
export declare function essentialNumPlan(db: AddOnWithRelatedData): boolean;
export declare function newTotalExecTimeField(connectionDetails: ConnectionDetailsWithAttachment): Promise<boolean>;
export declare function newBlkTimeFields(connectionDetails: ConnectionDetailsWithAttachment): Promise<boolean>;
