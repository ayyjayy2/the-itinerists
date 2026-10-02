import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Add to my calendar downloads a calendar file of my part of the trip', async ({ page }) => {
  await page.goto('/itinerary');
  await page.waitForLoadState('networkidle');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Add to my calendar' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const ics = fs.readFileSync(await download.path(), 'utf8');
  expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  const events = ics.split('BEGIN:VEVENT').length - 1;
  expect(events).toBeGreaterThan(3);
  expect(ics).toContain('SUMMARY:✈ ');                         // my flights
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);                 // timed events as exact moments
  await expect(page.getByRole('status').filter({ hasText: 'Downloaded' })).toBeVisible();
  console.log(`${events} events in ${download.suggestedFilename()}`);
});
