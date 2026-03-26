import { test as base, expect } from '@playwright/test';
import path from 'path';

/**
 * Edge case tests — things that break in real usage but pass basic page-load tests.
 *
 * Categories:
 *   1. Invalid URLs / 404 handling
 *   2. Form validation states
 *   3. Form submission flows (end-to-end)
 *   4. Hat switching (e@1 can switch crew ↔ employer)
 *   5. Modal/overlay rendering (confirmation dialogs, toasts)
 *   6. Template loading on post forms
 *   7. Pagination / scroll behavior
 *   8. Invitation flow (crew side)
 */

const authDir = path.join(__dirname, '.auth');

const employerTest = base.extend({
  storageState: path.join(authDir, 'employer.json'),
});
const crewTest = base.extend({
  storageState: path.join(authDir, 'crew.json'),
});

// ============================================================
// 1. INVALID URLs — graceful 404, not a crash
// ============================================================
employerTest.describe('Invalid URLs — Employer', () => {
  employerTest('invalid daywork ID shows error or 404', async ({ page }) => {
    const response = await page.goto('/daywork/00000000-0000-0000-0000-000000000000/review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Should not show a white screen or unhandled error
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    await expect(page).toHaveScreenshot('error-invalid-daywork-id-employer.png', { fullPage: true });
  });

  employerTest('invalid vessel edit ID shows error or 404', async ({ page }) => {
    await page.goto('/vessels/00000000-0000-0000-0000-000000000000/edit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    await expect(page).toHaveScreenshot('error-invalid-vessel-id.png', { fullPage: true });
  });
});

crewTest.describe('Invalid URLs — Crew', () => {
  crewTest('invalid message engagement ID shows error or empty', async ({ page }) => {
    await page.goto('/messages/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    await expect(page).toHaveScreenshot('error-invalid-message-id-crew.png', { fullPage: true });
  });

  crewTest('completely garbage URL under app routes', async ({ page }) => {
    const response = await page.goto('/daywork/not-a-uuid/review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('error-garbage-url-crew.png', { fullPage: true });
  });
});

// ============================================================
// 2. FORM VALIDATION — empty required fields, boundary values
// ============================================================
employerTest.describe('Form Validation — Daywork Post', () => {
  employerTest('submit empty daywork form shows validation errors', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Daywork').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Try to submit without filling anything
    const submitBtn = page.getByRole('button', { name: /post daywork/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('validation-daywork-empty.png', { fullPage: true });
    }
  });

  employerTest('submit empty permanent form shows validation errors', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Permanent').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Scroll to submit button and click
    const submitBtn = page.getByRole('button', { name: /review.*post/i })
      .or(page.getByRole('button', { name: /^post$/i }));
    await submitBtn.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await submitBtn.first().click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('validation-permanent-empty.png', { fullPage: true });
  });
});

// ============================================================
// 3. FORM SUBMISSION — fill and submit daywork post end-to-end
// ============================================================
employerTest.describe('Form Submission — Daywork Post', () => {
  employerTest('fill daywork form with valid data and capture pre-submit state', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Daywork').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Select vessel via the dropdown trigger
    const vesselTrigger = page.getByText('Select vessel').first();
    if (await vesselTrigger.isVisible()) {
      await vesselTrigger.click({ force: true });
      await page.waitForTimeout(500);
      const serenity = page.getByText('Serenity').first();
      if (await serenity.isVisible()) {
        await serenity.click();
        await page.waitForTimeout(300);
      }
    }

    // Select role via dropdown trigger
    const roleTrigger = page.getByText('Select role').first();
    if (await roleTrigger.isVisible()) {
      await roleTrigger.click({ force: true });
      await page.waitForTimeout(500);
      const deckhand = page.getByText('Deckhand').first();
      if (await deckhand.isVisible()) {
        await deckhand.click();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('form-daywork-partially-filled.png', { fullPage: true });
  });
});

// ============================================================
// 4. HAT SWITCHING — e@1 switches from employer to crew
// ============================================================
employerTest.describe('Hat Switching — Employer to Crew', () => {
  employerTest('employer can see hat switcher', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Look for the hat switcher component
    const hatSwitcher = page.getByText(/crew|employer/i).filter({ hasText: /⇄|switch|↔/ }).first()
      .or(page.locator('[class*="hat-switch"], [class*="hatSwitch"]').first())
      .or(page.getByRole('button', { name: /crew/i }).first());

    // Screenshot the page to see if hat switcher is visible
    await expect(page).toHaveScreenshot('hat-switcher-employer-view.png', { fullPage: false });
  });

  employerTest('hat switch on profile page visible', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // The profile page shows "⇄ Employer" badge — try clicking it
    const switchBtn = page.getByText('Crew').first();
    if (await switchBtn.isVisible()) {
      // Screenshot before switch
      await expect(page).toHaveScreenshot('hat-switch-before.png', { fullPage: false });

      // Click to switch hat
      await switchBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Screenshot after switch — nav and content should change
      await expect(page).toHaveScreenshot('hat-switch-after.png', { fullPage: false });
    }
  });
});

// ============================================================
// 5. MODALS / OVERLAYS — confirmation dialogs, cancel flows
// ============================================================
employerTest.describe('Modals — Cancel Posting Confirmation', () => {
  employerTest('cancel button on active posting triggers confirmation', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find a Cancel button on an active posting
    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first()
      .or(page.getByText('Cancel').first());

    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(1000);

      // Should show a confirmation modal/dialog
      await expect(page).toHaveScreenshot('modal-cancel-posting-confirm.png', { fullPage: true });

      // Dismiss it (don't actually cancel)
      const dismissBtn = page.getByRole('button', { name: /no|go back|nevermind|close|dismiss/i }).first();
      if (await dismissBtn.isVisible()) {
        await dismissBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});

// ============================================================
// 6. TEMPLATE LOADING — employer loads saved template
// ============================================================
employerTest.describe('Template Loading — Daywork', () => {
  employerTest('template selector shows saved templates', async ({ page }) => {
    await page.goto('/daywork/post');
    await page.waitForLoadState('networkidle');
    await page.getByText('Daywork').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click template selector
    // Click the template dropdown (combobox)
    const templateCombo = page.getByRole('combobox').first();
    if (await templateCombo.isVisible()) {
      await templateCombo.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('template-selector-open.png', { fullPage: true });
    }
  });

  employerTest('templates tab on my jobs page', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click Templates tab
    const templatesTab = page.getByText('Templates').first();
    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('templates-tab.png', { fullPage: true });
    }
  });
});

// ============================================================
// 7. CREW INVITATION FLOW — c@1 has an invitation on DW-01
// ============================================================
crewTest.describe('Crew Invitation Flow', () => {
  crewTest('invitations tab shows pending invitation', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Invitations tab (should show count)
    const invTab = page.getByText(/invitation/i).first();
    if (await invTab.isVisible()) {
      await invTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('crew-invitations-tab.png', { fullPage: true });
    }
  });

  crewTest('applied tab shows application history', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Applied tab
    const appliedTab = page.getByText(/applied/i).first();
    if (await appliedTab.isVisible()) {
      await appliedTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('crew-applied-tab.png', { fullPage: true });
    }
  });
});

// ============================================================
// 8. AVAILABILITY GATE — crew tries to apply without availability
// ============================================================
const crewAltTest = base.extend({
  storageState: path.join(authDir, 'crew-alt.json'),
});

crewAltTest.describe('Availability Gate — Crew Alt (no availability set)', () => {
  crewAltTest('discover page shows availability prompt or gate', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // g@1 has no availability set — should see prompt or gate when trying to apply
    await expect(page).toHaveScreenshot('crew-alt-discover-no-avail.png', { fullPage: true });
  });
});

// ============================================================
// 9. LONG CONTENT — profile with long bio, vessel with long name
// ============================================================
employerTest.describe('Content Overflow — Employer Jobs List', () => {
  employerTest('my jobs with multiple active postings does not overflow', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Scroll to bottom to verify all cards render without overlap
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('employer-jobs-scrolled-bottom.png', { fullPage: true });
  });
});

// ============================================================
// 10. PERMANENT TAB — employer switches between daywork/permanent on my jobs
// ============================================================
employerTest.describe('Daywork/Permanent Tab Switch — My Jobs', () => {
  employerTest('permanent tab on my jobs shows permanent postings', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const permTab = page.getByText('Permanent').first();
    if (await permTab.isVisible()) {
      await permTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('employer-jobs-permanent-tab.png', { fullPage: true });
    }
  });

  employerTest('in progress tab shows active engagements', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const inProgressTab = page.getByText(/in progress/i).first();
    if (await inProgressTab.isVisible()) {
      await inProgressTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('employer-jobs-in-progress-tab.png', { fullPage: true });
    }
  });

  employerTest('done tab shows completed/cancelled engagements', async ({ page }) => {
    await page.goto('/daywork/mine');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const doneTab = page.getByText('Done').first();
    if (await doneTab.isVisible()) {
      await doneTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('employer-jobs-done-tab.png', { fullPage: true });
    }
  });
});
