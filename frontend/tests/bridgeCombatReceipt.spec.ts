import { test, expect } from '@playwright/test';
import { missionPath, type SquadId } from '../src/isoScenarioCampaign';
import {
  replayCombatCommands, serializeCombatReplay, COMBAT_REPLAY_SAVE_KEY,
  type CombatReplayAction,
} from '../src/isoScenarioCombatReplay';
import { COMBAT_EXTRACTION_RECEIPT_KEY } from '../src/isoScenarioCombatExtractionReceipt';
import { COMBAT_EXTRACTION_LEDGER_KEY } from '../src/isoScenarioCombatExtractionLedger';
import { COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY } from '../src/isoScenarioCombatExtractionAttemptLedger';
import { COMBAT_MISSION_INSTANCE_SAVE_KEY } from '../src/isoScenarioCombatMissionInstanceSession';
import { COMBAT_CAMPAIGN_ACCEPTANCE_KEY } from '../src/isoScenarioCombatCampaignAcceptance';

const victory: CombatReplayAction[] = [
  { type: 'move', officer: 'security', cell: '3:7' },
  { type: 'move', officer: 'security', cell: '5:6' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'end-turn' },
  { type: 'fire', officer: 'security', hostile: 'aegis' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
  { type: 'fire', officer: 'security', hostile: 'veil' },
];

function extractedOrders(): CombatReplayAction[] {
  const actions: CombatReplayAction[] = [...victory];
  const mission = () => replayCombatCommands('relay', actions).combat.encounter.mission;
  const order = (action: CombatReplayAction) => {
    if (action.type !== 'end-turn' && mission().ap === 0) actions.push({ type: 'end-turn' });
    actions.push(action);
    replayCombatCommands('relay', actions);
  };
  const travel = (officer: SquadId, destination: string) => {
    let path = missionPath(mission(), officer, destination);
    expect(path).not.toBeNull();
    while (path!.length > 1) {
      order({ type: 'move', officer, cell: path![Math.min(5, path!.length - 1)] });
      path = missionPath(mission(), officer, destination);
      expect(path).not.toBeNull();
    }
  };
  travel('science', '9:1');
  order({ type: 'scan', officer: 'science' });
  travel('security', '9:7');
  order({ type: 'operate', officer: 'security' });
  travel('security', '9:9');
  order({ type: 'extract', officer: 'security' });
  return actions;
}

const extracted = serializeCombatReplay('relay', extractedOrders());
const unextracted = serializeCombatReplay('relay', victory);


for (const width of [390, 1280]) {
  test(`bridge records and lists verified extractions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    await page.evaluate(({ key, checkpoint }) => localStorage.setItem(key, checkpoint),
      { key: COMBAT_REPLAY_SAVE_KEY, checkpoint: extracted });
    await page.reload();
    const legacyBefore = await page.evaluate(() =>
      localStorage.getItem('shadowops.star-adventures.border-signal.v2'));

    const panel = page.getByTestId('bridge-combat-report');
    await panel.locator('summary').first().click();
    await expect(page.getByTestId('bridge-combat-status')).toContainText('Extracción confirmada');
    await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('0 extracciones');
    const button = page.getByTestId('bridge-combat-record-extraction');
    await expect(button).toBeVisible();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))
      .toBeNull();

    await button.click();
    await expect(page.getByTestId('bridge-combat-receipt-status')).toContainText('añadida');
    await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('1 extracción');
    await expect(button).toBeDisabled();
    const saved = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY);
    expect(JSON.parse(saved!)).toEqual({ version: 2, checkpoints: [extracted] });
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_RECEIPT_KEY))
      .toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_REPLAY_SAVE_KEY))
      .toBe(extracted);
    expect(await page.evaluate(() => localStorage.getItem('shadowops.star-adventures.border-signal.v2')))
      .toBe(legacyBefore);

    await page.getByTestId('bridge-combat-ledger-summary').click();
    await expect(page.getByTestId('bridge-combat-ledger-entries').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('bridge-combat-ledger-entries')).toContainText('PV de daño');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-extraction-history-${width}.png`, fullPage: true });

    await page.reload();
    await panel.locator('summary').first().click();
    await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('1 extracción');
    await button.click();
    await expect(page.getByTestId('bridge-combat-receipt-status')).toContainText('ya estaba registrada');
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))
      .toBe(saved);
  });
}

test('bridge cannot register combat victory or a corrupted checkpoint', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
    { key: COMBAT_REPLAY_SAVE_KEY, value: unextracted });
  await page.reload();
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await expect(page.getByTestId('bridge-combat-status')).toContainText('extracción pendiente');
  await expect(page.getByTestId('bridge-combat-record-extraction')).toHaveCount(0);
  await panel.locator('summary').first().click();
  await page.evaluate(key => localStorage.setItem(key, '{broken'), COMBAT_REPLAY_SAVE_KEY);
  await panel.locator('summary').first().click();
  await expect(page.getByTestId('bridge-combat-unavailable')).toContainText('incompatible');
  await expect(page.getByTestId('bridge-combat-record-extraction')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))
    .toBeNull();
});

test('bridge appends a distinct extraction and preserves the first one', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
    { key: COMBAT_REPLAY_SAVE_KEY, value: extracted });
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-record-extraction').click();
  const previous = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY);
  const actions = extractedOrders();
  const alternate = serializeCombatReplay('relay', [
    ...actions.slice(0, -1), { type: 'end-turn' }, actions[actions.length - 1],
  ]);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
    { key: COMBAT_REPLAY_SAVE_KEY, value: alternate });
  await panel.locator('summary').first().click();
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-record-extraction').click();
  await expect(page.getByTestId('bridge-combat-receipt-status')).toContainText('añadida');
  const current = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY);
  expect(current).not.toBe(previous);
  expect(JSON.parse(current!)).toEqual({ version: 2, checkpoints: [extracted, alternate] });
  await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('2 extracciones');
  await page.getByTestId('bridge-combat-ledger-summary').click();
  await expect(page.getByTestId('bridge-combat-ledger-entries').locator('li')).toHaveCount(2);
});

test('bridge reads v1 receipt as history but does not rewrite it', async ({ page }) => {
  const actions = extractedOrders();
  const alternate = serializeCombatReplay('relay', [
    ...actions.slice(0, -1), { type: 'end-turn' }, actions[actions.length - 1],
  ]);
  const legacy = JSON.stringify({ version: 1, checkpoint: extracted });
  await page.goto('/');
  await page.evaluate(({ oldKey, oldValue, key, value }) => {
    localStorage.setItem(oldKey, oldValue);
    localStorage.setItem(key, value);
  }, { oldKey: COMBAT_EXTRACTION_RECEIPT_KEY, oldValue: legacy,
    key: COMBAT_REPLAY_SAVE_KEY, value: alternate });
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('1 extracción');
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))
    .toBeNull();
  await page.getByTestId('bridge-combat-record-extraction').click();
  await expect(page.getByTestId('bridge-combat-ledger-summary')).toContainText('2 extracciones');
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_RECEIPT_KEY))
    .toBe(legacy);
  expect(JSON.parse((await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))!))
    .toEqual({ version: 2, checkpoints: [extracted, alternate] });
});

test('bridge refuses incompatible ledger without deleting saved evidence', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, value, ledgerKey }) => {
    localStorage.setItem(key, value);
    localStorage.setItem(ledgerKey, '{broken');
  }, { key: COMBAT_REPLAY_SAVE_KEY, value: extracted, ledgerKey: COMBAT_EXTRACTION_LEDGER_KEY });
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-ledger-summary').click();
  await expect(page.getByTestId('bridge-combat-ledger-error')).toContainText('incompatible');
  await page.getByTestId('bridge-combat-record-extraction').click();
  await expect(page.getByTestId('bridge-combat-receipt-status')).toContainText('incompatible');
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY))
    .toBe('{broken');
});

const FIRST_ATTEMPT = '12345678-1234-4234-8234-123456789abc';
const SECOND_ATTEMPT = '87654321-4321-4321-8321-abcdefabcdef';

for (const width of [390, 1280]) {
  test(`bridge records separate v3 mission attempts with identical orders at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    await page.evaluate(({ replayKey, identityKey, ledgerKey, checkpoint, id }) => {
      localStorage.removeItem(ledgerKey);
      localStorage.setItem(replayKey, checkpoint);
      localStorage.setItem(identityKey, JSON.stringify({ version: 1, instanceId: id, checkpoint }));
    }, { replayKey: COMBAT_REPLAY_SAVE_KEY, identityKey: COMBAT_MISSION_INSTANCE_SAVE_KEY,
      ledgerKey: COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, checkpoint: extracted, id: FIRST_ATTEMPT });
    await page.reload();

    const panel = page.getByTestId('bridge-combat-report');
    await panel.locator('summary').first().click();
    await expect(page.getByTestId('bridge-combat-status')).toContainText('Extracción confirmada');
    await expect(page.getByTestId('bridge-combat-record-extraction')).toHaveCount(0);
    const button = page.getByTestId('bridge-combat-record-attempt');
    await expect(button).toBeVisible();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('bridge-combat-attempt-ledger-summary')).toContainText('0 misiones');
    const previous = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY);

    await button.click();
    await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('añadida');
    await expect(page.getByTestId('bridge-combat-attempt-ledger-summary')).toContainText('1 misión');
    await expect(button).toBeDisabled();
    const saved = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
    expect(JSON.parse(saved!)).toEqual({ version: 3, attempts: [
      { instanceId: FIRST_ATTEMPT, checkpoint: extracted },
    ] });
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY)).toBe(previous);

    await page.reload();
    await panel.locator('summary').first().click();
    await expect(page.getByTestId('bridge-combat-attempt-ledger-summary')).toContainText('1 misión');
    await button.click();
    await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('ya estaba registrada');
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY)).toBe(saved);

    // Another genuine attempt can share the exact replay without being deduplicated.
    await panel.locator('summary').first().click();
    await page.evaluate(({ key, checkpoint }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 1, instanceId: '87654321-4321-4321-8321-abcdefabcdef', checkpoint,
      }));
    }, { key: COMBAT_MISSION_INSTANCE_SAVE_KEY, checkpoint: extracted });
    await panel.locator('summary').first().click();
    await button.click();
    await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('añadida');
    await expect(page.getByTestId('bridge-combat-attempt-ledger-summary')).toContainText('2 misiones');
    await page.getByTestId('bridge-combat-attempt-ledger-summary').click();
    await expect(page.getByTestId('bridge-combat-attempt-ledger-entries').locator('li')).toHaveCount(2);
    const after = await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
    expect(JSON.parse(after!).attempts).toEqual([
      { instanceId: FIRST_ATTEMPT, checkpoint: extracted },
      { instanceId: SECOND_ATTEMPT, checkpoint: extracted },
    ]);
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_LEDGER_KEY)).toBe(previous);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-identified-attempts-${width}.png`, fullPage: true });
  });
}

test('bridge refuses mismatched identity and incompatible v3 history without rewriting either', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ replayKey, identityKey, ledgerKey, checkpoint, mismatch }) => {
    localStorage.setItem(replayKey, checkpoint);
    localStorage.setItem(identityKey, JSON.stringify({
      version: 1, instanceId: '12345678-1234-4234-8234-123456789abc', checkpoint: mismatch,
    }));
    localStorage.removeItem(ledgerKey);
  }, { replayKey: COMBAT_REPLAY_SAVE_KEY, identityKey: COMBAT_MISSION_INSTANCE_SAVE_KEY,
    ledgerKey: COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, checkpoint: extracted, mismatch: unextracted });
  await page.reload();
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-record-attempt').click();
  await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('no coinciden');
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY))
    .toBeNull();

  await panel.locator('summary').first().click();
  await page.evaluate(({ identityKey, ledgerKey, checkpoint }) => {
    localStorage.setItem(identityKey, JSON.stringify({
      version: 1, instanceId: '12345678-1234-4234-8234-123456789abc', checkpoint,
    }));
    localStorage.setItem(ledgerKey, '{broken');
  }, { identityKey: COMBAT_MISSION_INSTANCE_SAVE_KEY,
    ledgerKey: COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, checkpoint: extracted });
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-attempt-ledger-summary').click();
  await expect(page.getByTestId('bridge-combat-attempt-ledger-error')).toContainText('incompatible');
  await page.getByTestId('bridge-combat-record-attempt').click();
  await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('incompatible');
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY))
    .toBe('{broken');
  await expect(page.getByTestId('bridge-combat-record-extraction')).toHaveCount(0);
});


for (const width of [390, 1280]) {
  test(`bridge accepts a verified mission explicitly and keeps it after F5 at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    await page.evaluate(({ replayKey, identityKey, checkpoint, instanceId }) => {
      localStorage.setItem(replayKey, checkpoint);
      localStorage.setItem(identityKey, JSON.stringify({ version: 1, instanceId, checkpoint }));
    }, { replayKey: COMBAT_REPLAY_SAVE_KEY, identityKey: COMBAT_MISSION_INSTANCE_SAVE_KEY,
      checkpoint: extracted, instanceId: FIRST_ATTEMPT });
    await page.reload();
    const panel = page.getByTestId('bridge-combat-report');
    await panel.locator('summary').first().click();
    await page.getByTestId('bridge-combat-record-attempt').click();
    await expect(page.getByTestId('bridge-combat-attempt-status')).toContainText('añadida');
    const sourceBefore = await page.evaluate(key => localStorage.getItem(key),
      COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY);
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_CAMPAIGN_ACCEPTANCE_KEY))
      .toBeNull();

    await page.getByTestId('bridge-combat-attempt-ledger-summary').click();
    const accept = page.getByTestId(`bridge-combat-accept-${FIRST_ATTEMPT}`);
    await expect(accept).toBeVisible();
    expect((await accept.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await accept.click();
    await expect(page.getByTestId('bridge-combat-acceptance-status')).toContainText('aceptada');
    await expect(page.getByTestId(`bridge-combat-accepted-${FIRST_ATTEMPT}`))
      .toContainText('sin recompensas');
    const accepted = await page.evaluate(key => localStorage.getItem(key),
      COMBAT_CAMPAIGN_ACCEPTANCE_KEY);
    expect(JSON.parse(accepted!)).toEqual({ version: 1, accepted: [
      { instanceId: FIRST_ATTEMPT, checkpoint: extracted },
    ] });
    expect(await page.evaluate(key => localStorage.getItem(key),
      COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY)).toBe(sourceBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bridge-accepted-mission-${width}.png`, fullPage: true });

    await page.reload();
    await panel.locator('summary').first().click();
    await page.getByTestId('bridge-combat-attempt-ledger-summary').click();
    await expect(page.getByTestId(`bridge-combat-accepted-${FIRST_ATTEMPT}`)).toBeVisible();
    await expect(accept).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_CAMPAIGN_ACCEPTANCE_KEY))
      .toBe(accepted);
  });
}

test('bridge fails closed when accepted-mission evidence is corrupted', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ replayKey, identityKey, sourceKey, acceptedKey, checkpoint, instanceId }) => {
    localStorage.setItem(replayKey, checkpoint);
    localStorage.setItem(identityKey, JSON.stringify({ version: 1, instanceId, checkpoint }));
    localStorage.setItem(sourceKey, JSON.stringify({ version: 3, attempts: [{ instanceId, checkpoint }] }));
    localStorage.setItem(acceptedKey, '{broken');
  }, { replayKey: COMBAT_REPLAY_SAVE_KEY, identityKey: COMBAT_MISSION_INSTANCE_SAVE_KEY,
    sourceKey: COMBAT_EXTRACTION_ATTEMPT_LEDGER_KEY, acceptedKey: COMBAT_CAMPAIGN_ACCEPTANCE_KEY,
    checkpoint: extracted, instanceId: FIRST_ATTEMPT });
  await page.reload();
  const panel = page.getByTestId('bridge-combat-report');
  await panel.locator('summary').first().click();
  await page.getByTestId('bridge-combat-attempt-ledger-summary').click();
  await expect(page.getByTestId('bridge-combat-acceptance-error')).toContainText('incompatible');
  await expect(page.getByTestId(`bridge-combat-accept-${FIRST_ATTEMPT}`)).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), COMBAT_CAMPAIGN_ACCEPTANCE_KEY))
    .toBe('{broken');
});
