/**
 * The app's copy of the server's rules engine and data (mobile/shared/, made by `npm run sync-shared`
 * in server/). The backend rules are the source of truth: never decide a bin in app code, ask this.
 */
import raw from '../../shared/data/quebecRules.json';
import { createRulesEngine } from '../../shared/services/rulesEngine';

export const rules = createRulesEngine(raw);
