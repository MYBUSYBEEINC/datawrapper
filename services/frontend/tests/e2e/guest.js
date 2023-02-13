describe('guest', () => {
    let chartId;
    let nanoid;

    before(async () => {
        ({ nanoid } = await browser.requireDeps('nanoid'));
        await browser.logIP();
    });

    after(async () => {
        if (chartId) {
            await browser.deleteChart(chartId);
        }
    });

    it('creates a chart and accepts invite', async () => {
        const chartTitle = `Test chart ${Math.round(Math.random() * 1e6)}`;

        // Sign in page
        await browser.url('/');
        await browser.waitForUrl('/signin?ref=/');

        // Create
        const $createChartAsGuest = await $('a[href="/create/chart"]');
        await expect($createChartAsGuest).toBeDisplayed();
        await $createChartAsGuest.click();

        await browser.closeWindow();
        await browser.switchWindow(/\/chart\/\w{5}\/upload/);

        await browser.waitForUrl(/\/chart\/\w{5}\/upload/);
        chartId = await browser.getChartIdFromUrl();

        // Upload
        const $uploadTextarea = await $('>>>#upload-data-text');
        await $uploadTextarea.waitForDisplayed();
        await $uploadTextarea.setValue(
            `Topic;Very high trust;High trust;No answer;Low trust;Very low trust
Mediterranean Migrant Crisis;3;45;2;41;9
Protests of Islam critical PEGIDA movement in Dresden;3;37;4;41;15
Financial Crisis in Greece;4;31;2;46;17
Ukraine conflict between Russia and Western Countries;2;30;2;52;14`
        );
        const $uploadProceed = await $('[data-uid="upload-proceed-button"]');
        await expect($uploadProceed).toBeDisplayed();
        await $uploadProceed.click(); // Go to the next step.
        await browser.waitForUrl(/\/chart\/\w{5}\/describe/);

        // Describe
        const $describeCell = await $('>>>table.htCore tbody tr:nth-child(2) td:last-child');
        await $describeCell.waitForDisplayed();
        await expect($describeCell).toHaveElementClass('numberType');
        await expect($describeCell).toHaveText('9');
        const $describeProceed = await $('[data-uid="describe-proceed-button"]');
        await $describeProceed.waitForClickable();
        await $describeProceed.click(); // Go to the next step.

        // Visualize
        await browser.switchToFrameById('iframe-vis');
        const $visualizePreviewLines = await $('.dw-chart.vis-d3-lines');
        await $visualizePreviewLines.waitForDisplayed(); // Wait for the default line chart to load before switching the type.
        await browser.switchToParentFrame();
        const $visualizeChartTypeTab = await $('a[href="#select-vis"]');
        await $visualizeChartTypeTab.click(); // Switch to the Chart type tab.
        const $visualizeChartTypeButton = await $('.title=Stacked Bars');
        await $visualizeChartTypeButton.waitForDisplayed();
        await $visualizeChartTypeButton.parentElement().click(); // Change chart type.
        await browser.switchToFrameById('iframe-vis');
        const $visualizePreviewBars = await $('.dw-chart.vis-d3-bars-stacked');
        await $visualizePreviewBars.waitForDisplayed(); // Check the chart type in the iframe.
        await browser.switchToParentFrame();
        const $visualizeAnnotateTab = await $('a[href="#annotate"]');
        await expect($visualizeAnnotateTab).toBeDisplayed();
        await $visualizeAnnotateTab.click(); // Switch to the Annotate tab.

        // Annotate
        const $annotateTitle = await $('[data-uid="annotate-chart-title"] textarea');
        await $annotateTitle.waitForDisplayed();
        await $annotateTitle.setValue(chartTitle); // Change chart title.
        await browser.switchToFrameById('iframe-vis');
        const $annotatePreviewHeadline = await $('.headline-block');
        await expect($annotatePreviewHeadline).toBeDisplayed();
        await expect($annotatePreviewHeadline).toHaveTextContaining(chartTitle); // Check the chart title in the iframe.
        await browser.switchToParentFrame();
        const $annotatePublishStep = await $('a[href="publish"]');
        await expect($annotatePublishStep).toBeDisplayed();
        await $annotatePublishStep.click(); // Go to the Publish step.

        // Create account to publish
        const $emailInput = await $(">>>[data-uid='guest-email'] input");
        await $emailInput.waitForDisplayed();
        const newUserEmail = `e2e-test+${nanoid(4)}@datawrapper.de`;
        await $emailInput.setValue(newUserEmail);
        const $createAccountButton = await $(">>>[data-uid='guest-email'] button");
        await $createAccountButton.waitForDisplayed();
        await $createAccountButton.click();
        const $pendingActivation = await $(">>>[data-uid='pending-activation-title']");
        await $pendingActivation.waitForDisplayed({ timeout: 60 * 1000 }); // Wait for publishing with increased timeout, because it can take long on staging.

        // Get account invite link
        const accountInviteUrl = await browser.waitForAccountInviteUrl(newUserEmail);

        // Delete cookies so that we start with a clean slate
        await browser.deleteCookies();

        // Visit invite link
        await browser.url(accountInviteUrl);
        await browser.waitForUrl(accountInviteUrl);

        // Enter new password
        const $passwordInput = await $('#set-pwd');
        await $passwordInput.waitForDisplayed();
        const newPassword = nanoid(8);
        await $passwordInput.setValue(newPassword);
        const $resetPasswordButton = await $("[data-uid='set-password-button']");
        await $resetPasswordButton.waitForDisplayed();
        await $resetPasswordButton.click();

        // Wait for re-direct to publish step
        await browser.waitForUrl(/\/chart\/\w{5}\/publish/);
    });
});
