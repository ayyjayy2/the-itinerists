import { test, expect } from '@playwright/test';

// #412: an activity can't end before (or when) it starts, when adding or editing.
const MSG = 'End time must be after the start time.';

test('adding an activity that ends before it starts is refused, keeps what was typed, and saves once fixed', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  await page.locator('.add-day-btn').first().click();
  const form = page.locator('.add-form, .inline-add, form, .card').filter({ has: page.getByRole('button', { name: 'Add Event' }) }).last();
  await form.getByPlaceholder("What's happening?").fill('Backwards boat trip');
  await form.getByLabel('Start time').fill('14:00');
  await form.getByLabel('End time').fill('13:00');
  await expect(form.getByText(MSG)).toBeVisible();
  await expect(form.getByRole('button', { name: 'Add Event' })).toBeDisabled();
  await expect(form.getByPlaceholder("What's happening?")).toHaveValue('Backwards boat trip');   // nothing lost

  await form.getByLabel('End time').fill('16:00');
  await expect(form.getByText(MSG)).toHaveCount(0);
  await form.getByRole('button', { name: 'Add Event' }).click();
  await expect(page.locator('.itinerary-item', { hasText: 'Backwards boat trip' })).toContainText('4:00 PM');
});

test('editing an activity to end before it starts is refused the same way', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  await page.locator('.itinerary-item').first().locator('button.edit-btn').click();
  const form = page.locator('.itinerary-item').filter({ has: page.locator('.edit-actions') });
  await form.getByLabel('Start time').fill('14:00');
  await form.getByLabel('End time').fill('14:00');
  await expect(form.getByText(MSG)).toBeVisible();
  await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await form.getByLabel('End time').fill('15:30');
  await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});
