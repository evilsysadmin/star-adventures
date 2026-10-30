import { test, expect, type Page } from '@playwright/test';

// Route to a station from the bridge spawn (3:5 N). No warp/remote cheats.
async function openStation(page: Page, station: 'science' | 'communications' | 'tactical' | 'helm' | 'command') {
  const act = async (id: string, n = 1) => {
    for(let i=0;i<n;i++) await page.getByTestId('explore-' + id).click();
  };
  if(station === 'science') { await act('left'); await act('forward',2); await act('right'); await act('forward'); }
  else if(station === 'communications') { await act('right'); await act('forward',2); await act('left'); await act('forward',2); }
  else if(station === 'tactical') { await act('right'); await act('forward',3); await act('left'); await act('forward',2); await act('right'); }
  else if(station === 'helm') { await act('forward',2); }
  else { await act('right'); await act('forward'); await act('left'); }
  await act('use');
  await expect(page.getByTestId('console-locked').or(page.locator('.choice-list'))).toBeVisible();
}


for (const width of [360, 390, 430, 1280]) {
  test(`bridge fits ${width}px and requires an actual console`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 820 : 850 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Ecos en la frontera/i })).toBeVisible();
    await expect(page.getByTestId('console-locked')).toBeVisible();
    await expect(page.getByTestId('choice-scan')).toHaveCount(0);
    await expect(page.getByTestId('choice-hail')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/bridge-${width}.png`, fullPage: true });
  });
}

test.describe('puesto del capitán: tres finales reales', () => {
  // Exercise the primary interface rather than coupling narrative outcomes
  // to the separate first-person bridge walking/navigation regression tests.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('science, diplomacy and tactical choices produce distinct genuine outcomes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('game-shell')).toHaveAttribute('data-interface', 'game');
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-science').click();
    await expect(page.getByTestId('choice-scan')).toBeVisible();
    await page.getByTestId('choice-scan').click();
    await expect(page.getByTestId('science-score')).toHaveText('02');
    await page.getByTestId('choice-broadcast').click();
    await expect(page.getByTestId('ending')).toContainText('Paz negociada');
    await expect(page.getByTestId('science-score')).toHaveText('05');

    await page.getByRole('button', { name: /Nueva misión/i }).click();
    await expect(page.getByTestId('science-score')).toHaveText('00');
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-comms').click();
    await expect(page.getByTestId('choice-hail')).toBeVisible();
    await page.getByTestId('choice-hail').click();
    await page.getByTestId('choice-mediate').click();
    await expect(page.getByTestId('diplomacy-score')).toHaveText('05');
    await expect(page.getByTestId('ending')).toContainText('Paz negociada');

    await page.getByRole('button', { name: /Nueva misión/i }).click();
    await expect(page.getByTestId('captain-controls')).toBeVisible();
    await page.getByTestId('captain-tactical').click();
    await expect(page.getByTestId('choice-intercept')).toBeVisible();
    await page.getByTestId('choice-intercept').click();
    await page.getByTestId('choice-disable').click();
    await expect(page.getByTestId('damage-score')).toHaveText('01');
    await expect(page.getByTestId('ending')).toContainText('Victoria táctica');
  });
});

test('keyboard choices and skip-navigation work', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('1');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('00');
  await openStation(page, 'communications');
  await expect(page.getByTestId('choice-hail')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.keyboard.press('1');
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.keyboard.press('r');
  await expect(page.getByTestId('console-locked')).toBeVisible();
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir a las órdenes' })).toBeFocused();
});


test('a saved command history restores the same decision after refresh', async ({ page }) => {
  await page.goto('/');
  await openStation(page, 'communications');
  await page.getByTestId('choice-hail').click();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.reload();
  await expect(page.getByTestId('console-locked')).toBeVisible();
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N · 5:3');
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('choice-mediate')).toBeVisible();
  await expect(page.getByTestId('diplomacy-score')).toHaveText('02');
  await page.getByTestId('choice-mediate').click();
  await page.reload();
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('05');
});

test('corrupt local checkpoint falls back to a new mission without crashing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.border-signal.v2', '{bad save'));
  await page.reload();
  await expect(page.getByTestId('console-locked')).toBeVisible();
  await expect(page.getByText('Guardado incompatible · misión reiniciada')).toBeVisible();
});

test('station swaps change narrative outcomes and survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('crew-roster').locator('summary').click();
  await page.getByTestId('station-science').selectOption('dorn');
  await expect(page.getByTestId('station-tactical')).toHaveValue('venn');
  await openStation(page, 'science');
  await expect(page.getByTestId('staff-scan')).toContainText('Kael Dorn');
  await page.getByTestId('choice-scan').click();
  await page.getByTestId('choice-broadcast').click();
  await expect(page.getByTestId('ending')).toContainText('Retirada estratégica');
  await expect(page.getByTestId('narrative')).toContainText('La orden fracasa');
  await page.reload();
  await expect(page.getByTestId('ending')).toContainText('Retirada estratégica');
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science')).toHaveValue('dorn');
});

test('crew XP survives a new mission and F5', async ({ page }) => {
  await page.goto('/');
  await openStation(page, 'science');
  await page.getByTestId('choice-scan').click();
  await page.getByTestId('choice-broadcast').click();
  await page.getByRole('button', { name: /Nueva misión/i }).click();
  await page.reload();
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science').locator('..')).toContainText('75 XP');
  await expect(page.getByTestId('console-locked')).toBeVisible();
});

test('legacy v1 progress migrates exactly without retroactive XP', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('shadowops.star-adventures.border-signal.v2');
    localStorage.setItem('shadowops.star-adventures.border-signal.v1', JSON.stringify({
      saveVersion: 1, episodeId: 'border-signal', commands: ['scan']
    }));
  });
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('01');
  await openStation(page, 'science');
  await expect(page.getByTestId('choice-broadcast')).toBeVisible();
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science').locator('..')).toContainText('0 XP');
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('01');
});

test('corrupt v2 does not silently restore stale v1', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('shadowops.star-adventures.border-signal.v2', '{bad');
    localStorage.setItem('shadowops.star-adventures.border-signal.v1', JSON.stringify({
      saveVersion: 1, episodeId: 'border-signal', commands: ['hail']
    }));
  });
  await page.reload();
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await expect(page.getByTestId('diplomacy-score')).toHaveText('00');
  await expect(page.getByText('Guardado incompatible · misión reiniciada')).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`expanded crew roster stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 850 : 820 });
    await page.goto('/');
    await page.getByTestId('crew-roster').locator('summary').click();
    await expect(page.getByTestId('station-science')).toBeVisible();
    await expect(page.getByTestId('station-medicine')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/crew-roster-${width}.png`, fullPage: true });
    await page.getByTestId('station-science').selectOption('dorn');
    await expect(page.getByTestId('station-tactical')).toHaveValue('venn');
    await page.screenshot({ path: `test-results/crew-roster-swapped-${width}.png`, fullPage: true });
  });
}

test('walk the first-person bridge, operate a console, and cancel/confirm transport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await expect(page.getByTestId('explore-area')).toContainText('Puente de mando');
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N');
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('explore-feedback')).toContainText('Consola de navegación');
  await page.getByTestId('explore-backward').click();
  await page.getByTestId('explore-backward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await expect(page.getByTestId('explore-target')).toContainText('sala de transporte');
  await page.getByTestId('explore-use').click();
  await expect(page.getByRole('dialog')).toContainText('Confirmar cambio de área');
  await page.screenshot({ path: 'test-results/transport-confirm-390.png', fullPage: true });
  await page.getByTestId('transport-decline').click();
  await expect(page.getByTestId('explore-heading')).toContainText('4:5');
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N');
  await page.screenshot({ path: 'test-results/away-surface-390.png', fullPage: true });
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-use').click();
  await expect(page.getByTestId('explore-feedback')).toContainText('Sonda investigada');
  await expect(page.getByTestId('away-finding')).toContainText('firma mineral registrada');
});

for (const width of [360, 390, 430, 1280]) {
  test(`first-person viewport stays operable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/');
    await expect(page.getByTestId('explore-forward')).toBeVisible();
    await expect(page.getByTestId('explore-use')).toBeVisible();
    await expect(page.getByTestId('explore-area')).toContainText('Puente');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/firstperson-${width}.png`, fullPage: true });
  });
}

test('keyboard navigation reaches the transporter without stealing focus from select inputs', async ({ page }) => {
  await page.goto('/');
  // Wait for the mounted React viewport and its global keydown listener.
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N');
  await page.getByTestId('explore-right').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO S');
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('explore-heading')).toContainText('4:5');
});

test('moving away from a console immediately closes mission orders', async ({ page }) => {
  await page.goto('/');
  await openStation(page, 'science');
  await expect(page.getByTestId('choice-scan')).toBeVisible();
  await page.getByTestId('explore-backward').click();
  await expect(page.getByTestId('console-locked')).toBeVisible();
  await expect(page.getByTestId('choice-scan')).toHaveCount(0);
  await page.keyboard.press('1');
  await expect(page.getByTestId('science-score')).toHaveText('00');
});

test('surface exploration cannot execute ship orders using a stale station UI', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie');
  await expect(page.getByTestId('console-locked')).toContainText('Las operaciones de la nave');
  await expect(page.getByTestId('choice-scan')).toHaveCount(0);
  await page.keyboard.press('1');
  await expect(page.getByTestId('science-score')).toHaveText('00');
});

for(const width of [390,1280]) {
  test(`real science-console state has responsive orders at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width===390?850:820 });
    await page.goto('/');
    await openStation(page, 'science');
    await expect(page.getByTestId('choice-scan')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/console-science-${width}.png`, fullPage:true });
    await page.getByTestId('choice-scan').click();
    await expect(page.getByTestId('science-score')).toHaveText('02');
    await expect(page.getByTestId('choice-broadcast')).toBeVisible();
  });
}

for (const width of [360, 390, 430, 1280]) {
  test(`tactical camera proof stays visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 820 : 850 });
    await page.goto('/');
    await expect(page.getByTestId('tactical-canvas')).toBeVisible();
    await expect(page.getByTestId('tactical-mvs')).toContainText('oficial hombre 5:2');
    await page.getByRole('button', { name: 'Movimiento: correr' }).click();
    await expect(page.getByTestId('tactical-mvs')).toContainText('saltar 8 FPS');
    await page.getByRole('button', { name: 'Movimiento: saltar' }).click();
    await expect(page.getByTestId('tactical-mvs')).toContainText('agacharse 4 FPS');
    await page.getByRole('button', { name: 'Movimiento: agacharse' }).click();
    await expect(page.getByTestId('tactical-mvs')).toContainText('disparar 9 FPS');
    await page.getByRole('button', { name: 'Movimiento: disparar' }).click();
    await expect(page.getByTestId('tactical-mvs')).toContainText('recibir impacto 8 FPS');
    await page.getByRole('button', { name: 'Movimiento: recibir impacto' }).click();
    await expect(page.getByTestId('tactical-mvs')).toContainText('KIA 5 FPS');
    await page.getByRole('button', { name: '7:7' }).click();
    await expect(page.getByTestId('tactical-selected')).toContainText('7:7');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/tactical-camera-${width}.png`, fullPage: true });
  });
}

test('F5 restores bridge heading and walkable tile without replaying movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.getByTestId('explore-left').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO W · 2:5');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.spatial.v1') || '{}').x)).toBe(2);
  await page.reload();
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO W · 2:5');
  await page.screenshot({ path: 'test-results/reload-bridge-390.png', fullPage: true });
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-heading')).toContainText('1:5');
});

test('away team area, heading and location survive F5; return remains possible', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-heading')).toContainText('4:3');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.spatial.v1') || '{}').area)).toBe('surface');
  await page.reload();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N · 4:3');
  await expect(page.getByTestId('console-locked')).toContainText('Las operaciones de la nave');
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Puente de mando');
});

test('F5 closes unconfirmed transporter modal but leaves captain in the same cell', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.spatial.v1') || '{}').heading)).toBe('S');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO S · 4:5');
  await page.getByTestId('explore-use').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('transport-decline').click();
  await expect(page.getByTestId('explore-heading')).toContainText('4:5');
});

test('corrupt spatial state resets only exploration, preserving crew XP and mission', async ({ page }) => {
  await page.goto('/');
  await openStation(page,'science');
  await page.getByTestId('choice-scan').click();
  await expect(page.getByTestId('science-score')).toHaveText('02');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('shadowops.star-adventures.border-signal.v2')?.includes('scan'))).toBe(true);
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.spatial.v1', '{"saveVersion":1,"area":"bridge","x":0}'));
  await page.reload();
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N · 3:5');
  await expect(page.getByTestId('science-score')).toHaveText('02');
  await expect(page.getByTestId('console-locked')).toBeVisible();
  await openStation(page,'science');
  await page.getByTestId('choice-broadcast').click();
  await expect(page.getByTestId('ending')).toContainText('Paz negociada');
  await page.getByTestId('crew-roster').locator('summary').click();
  await expect(page.getByTestId('station-science').locator('..')).toContainText('75 XP');
});

async function beamDown(page: Page) {
  // From authored bridge spawn 3:5 N, approach transport at 4:6.
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-right').click();
  await page.getByTestId('explore-use').click();
  await page.getByTestId('transport-confirm').click();
  await expect(page.getByTestId('explore-area')).toContainText('Superficie planetaria');
}

async function inspectProbe(page: Page) {
  await page.getByTestId('explore-forward').click();
  await page.getByTestId('explore-forward').click();
  await expect(page.getByTestId('explore-target')).toContainText('Sonda científica');
  await page.getByTestId('explore-use').click();
}

test('selected three-person squad survives F5, deploys and makes a real scientific discovery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.getByTestId('away-slot-1').selectOption('rhee');
  await expect(page.getByTestId('away-slot-1')).toHaveValue('rhee');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.away-team.v1') || '{}').squad?.[1])).toBe('rhee');
  await page.reload();
  await expect(page.getByTestId('away-slot-1')).toHaveValue('rhee');
  await beamDown(page);
  await expect(page.getByTestId('away-party')).toContainText('Nara Venn');
  await expect(page.getByTestId('away-party')).toContainText('Tao Rhee');
  await expect(page.getByTestId('away-party')).toContainText('Isa Mira');
  await expect(page.getByTestId('away-slot-0')).toBeDisabled();
  await inspectProbe(page);
  await expect(page.getByTestId('away-finding')).toContainText('firma mineral registrada');
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await page.screenshot({ path: 'test-results/away-discovery-390.png', fullPage: true });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.away-team.v1') || '{}').findings?.length)).toBe(1);
  await page.reload();
  await expect(page.getByTestId('away-party')).toContainText('Tao Rhee');
  await expect(page.getByTestId('away-finding')).toContainText('firma mineral registrada');
  await expect(page.getByTestId('science-score')).toHaveText('00');
  await expect(page.getByTestId('explore-heading')).toContainText('4:3');
});

test('a squad without a scientist cannot conjure a probe finding', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('away-slot-0').selectOption('varela');
  await page.getByTestId('away-slot-2').selectOption('solan');
  await beamDown(page);
  await inspectProbe(page);
  await expect(page.getByTestId('away-finding')).toContainText('Investigación insuficiente');
  await expect(page.getByTestId('away-finding')).toContainText('2/5');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shadowops.star-adventures.away-team.v1') || '{}').findings?.length)).toBe(0);
  await page.reload();
  await expect(page.getByTestId('away-finding')).toContainText('Investigación insuficiente');
  await expect(page.getByTestId('away-slot-0')).toHaveValue('varela');
});

test('corrupted away-team save resets safely without erasing ship mission history', async ({ page }) => {
  await page.goto('/');
  await openStation(page, 'science');
  await page.getByTestId('choice-scan').click();
  await expect(page.getByTestId('science-score')).toHaveText('02');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('shadowops.star-adventures.border-signal.v2')?.includes('scan'))).toBe(true);
  await page.evaluate(() => localStorage.setItem('shadowops.star-adventures.away-team.v1', '{broken'));
  await page.reload();
  await expect(page.getByTestId('away-slot-0')).toHaveValue('venn');
  await expect(page.getByTestId('away-slot-1')).toHaveValue('dorn');
  await expect(page.getByTestId('science-score')).toHaveText('02');
  await expect(page.getByTestId('explore-heading')).toContainText('RUMBO N · 1:4');
});

for(const width of [360, 390, 430, 1280]) {
  test(`surface away-party layout remains within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await beamDown(page);
    await expect(page.getByTestId('away-party')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/away-party-${width}.png`, fullPage: true });
  });
}
