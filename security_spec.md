# Firestore Security Specifications & Invariants

## 1. Data Invariants
* **Authentication**: All read and write operations must be executed by authenticated users (`request.auth != null`).
* **Settings**: Global configuration has a strict single-document footprint at `/settings/global`. Field values (bitrates, positions) must match standard preset patterns.
* **Stream Keys**: RTMP destination names, server URLs, and keys are stored in `/stream_keys/{keyId}` and must be restricted to authenticated administrators.
* **Schedules**: Automated streaming schedules must contain valid timestamp objects matching standard patterns.
* **Logs**: Telemetry/event logs are system-written but readable by authenticated administrators.

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Mitigation Check)

1. **Unauthenticated Read Attempt on Settings**
   - Payload: GET request on `/settings/global` without credentials
   - Expected Outcome: `PERMISSION_DENIED`

2. **Unauthenticated Write Attempt on Stream Keys**
   - Payload: POST request on `/stream_keys/malicious` with custom credentials and key properties without auth headers
   - Expected Outcome: `PERMISSION_DENIED`

3. **Spoofed User Registration/Write**
   - Payload: Set document on `/stream_keys/target` trying to assign ownership to a different UID (`request.auth.uid != payload.ownerId`)
   - Expected Outcome: `PERMISSION_DENIED`

4. **Shadow field injection in Settings (Update-Gap)**
   - Payload: UPDATE on `/settings/global` adding `isSuperAdmin: true`
   - Expected Outcome: `PERMISSION_DENIED` (due to `affectedKeys()` constraints or strict key checks)

5. **Resource Exhaustion/ID Poisoning on Stream Keys**
   - Payload: CREATE with ID `streamkey-very-long-junk-id-over-128-characters-acting-as-denial-of-wallet-vector-to-crash-the-client-state`
   - Expected Outcome: `PERMISSION_DENIED`

6. **Invalid Status Transition (State Shortcutting) in Schedule**
   - Payload: UPDATE on `/schedules/{id}` changing `status` from `pending` directly to `completed` bypassing current processing steps
   - Expected Outcome: `PERMISSION_DENIED`

7. **Injecting Malicious String in Resolution Settings**
   - Payload: UPDATE `/settings/global` setting `resolution` to a 10MB string to exploit client memory limit
   - Expected Outcome: `PERMISSION_DENIED` (failed size limit check)

8. **Overwriting Read-Only Immutables**
   - Payload: UPDATE `/schedules/{id}` attempting to alter the original scheduled time or video reference after creation
   - Expected Outcome: `PERMISSION_DENIED`

9. **Writing System Logs as a Client**
   - Payload: CREATE `/logs/{id}` with customized timestamp or fake system event types
   - Expected Outcome: `PERMISSION_DENIED` (client-side log tampering check)

10. **Malicious Special Characters in document path IDs**
    - Payload: GET `/stream_keys/invalid_$_characters_!!`
    - Expected Outcome: `PERMISSION_DENIED` (failed `isValidId()` check)

11. **Malicious Client-Sourced Timestamps**
    - Payload: CREATE `/schedules/{id}` with a hardcoded future timestamp instead of `request.time`
    - Expected Outcome: `PERMISSION_DENIED`

12. **Blanket Query / Data Scraping Attempt**
    - Payload: Client list request on `/stream_keys` without filters, bypassing security constraints
    - Expected Outcome: `PERMISSION_DENIED` unless authorized

## 3. The Test Runner Reference (`firestore.rules.test.ts`)
```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore Security Rules', () => {
  let testEnv: any;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0256933491',
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('rejects unauthenticated reads', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.doc('settings/global').get());
  });

  it('allows authenticated users to view settings', async () => {
    const authedDb = testEnv.authenticatedContext('user_123').firestore();
    await assertSucceeds(authedDb.doc('settings/global').get());
  });
});
```
