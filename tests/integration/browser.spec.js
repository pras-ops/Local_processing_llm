import { test, expect } from '@playwright/test';

test.describe('RedactKit Demo Page', () => {
    test.beforeEach(async ({ page }) => {
        // Since the dev server runs on http://localhost:8080 by default (via http-server)
        await page.goto('http://localhost:8080/examples/basic-demo.html');
    });

    test('should load the page and perform rule-based PII redaction and restoration', async ({ page }) => {
        // 1. Verify initial state
        const title = await page.locator('h1').textContent();
        expect(title).toBe('RedactKit');

        // 2. Click Redact button
        await page.click('#redactBtn');

        // 3. Verify redacted output contains placeholders
        const redactedHtml = await page.innerHTML('#redactedTextHighlight');
        expect(redactedHtml).toContain('{{EMAIL_1}}');
        expect(redactedHtml).toContain('{{PHONE_1}}');
        expect(redactedHtml).toContain('{{CREDIT_CARD_1}}');

        // 4. Verify Vault table body contains the mapping values
        const vaultHtml = await page.innerHTML('#mapTableBody');
        expect(vaultHtml).toContain('john.doe@acme.org');
        expect(vaultHtml).toContain('+1 (555) 019-9999');

        // 5. Click simulate cloud response
        await page.click('#simulateResponseBtn');
        const cloudText = await page.inputValue('#cloudResponse');
        expect(cloudText).toContain('{{EMAIL_1}}');

        // 6. Click restore response
        await page.click('#restoreBtn');
        const restoredHtml = await page.innerHTML('#restoredTextHighlight');
        expect(restoredHtml).toContain('john.doe@acme.org');
        expect(restoredHtml).toContain('+1 (555) 019-9999');
    });
});
