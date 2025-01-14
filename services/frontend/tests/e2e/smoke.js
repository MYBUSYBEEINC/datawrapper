describe('smoke', () => {
    let got;
    let chartId;

    before(async () => {
        got = await browser.requireDeps('got');
        await browser.logIP();
        await browser.login(process.env.DW_USER, process.env.DW_PASS);
    });

    after(async () => {
        if (chartId) {
            await browser.deleteChart(chartId);
        }
    });

    it('creates a chart', async () => {
        const chartTitle = `Test chart ${Math.round(Math.random() * 1e6)}`;

        // Dashboard
        await browser.url('/');
        await browser.waitForUrl('/');

        // Create
        const $createDropdown = await $('.nav-item-create-new');
        await $createDropdown.click();
        const $createDropdownItem = await $('a[href="/create/chart"]');
        await expect($createDropdownItem).toBeDisplayed();
        await $createDropdownItem.click();
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
        const $visualizeRefineTab = await $('[data-uid="tab-refine"]');
        await $visualizeRefineTab.click(); // switch to refine tab

        // Make an edit in the refine tab
        const $showTotals = await $('>>>[data-uid="switch-show-totals"] label');
        await $showTotals.waitForDisplayed();
        await $showTotals.click();
        await browser.switchToFrameById('iframe-vis');
        const $totalLabel = await $('.bc-bar-total');
        await $totalLabel.waitForDisplayed();
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

        // Publish
        const $publishButton = await $('>>>.button-publish');
        await $publishButton.waitForDisplayed();
        await $publishButton.click();
        const $publishUrl = await $('>>>#share-url');
        await $publishUrl.waitForDisplayed({ timeout: 60 * 1000 }); // Wait for publishing with increased timeout, because it can take long on staging.
        await expect($publishUrl).toHaveValueContaining('/1/');
        const publishUrl = await $publishUrl.getValue();
        const publishHtml = await got.get(publishUrl, { resolveBodyOnly: true }); // Get the published chart HTML.
        await expect(publishHtml).toContain(chartTitle); // Check that the published HTML page contains the rendered chart.

        // Archive
        await browser.leavePage('/archive/recently-published');
        const $archiveBox = await $('.box');
        await $archiveBox.waitForDisplayed();
        await expect($archiveBox).toHaveTextContaining(chartTitle); // Check that the first box in the Archive is our chart.
        const $archiveBoxCaption = await $(`figcaption=${chartTitle}`);
        await expect($archiveBoxCaption).toBeDisplayed();
        const $archiveBoxDropdown = await $archiveBox.$('.dropdown');
        const $archiveBoxDropdownTrigger = await $archiveBoxDropdown.$('.dropdown-trigger'); // Open the dropdown menu of the box.
        await $archiveBoxDropdownTrigger.click(); // Open the dropdown menu of the box.
        const $archiveBoxDropdownDelete = await $archiveBoxDropdown.$(
            'a.dropdown-item[href="#/delete"]'
        );
        await expect($archiveBoxDropdownDelete).toBeDisplayed();
        await $archiveBoxDropdownDelete.click(); // Delete the chart.
        const $modalConfirmButton = await $('.modal-content button.is-danger');
        await expect($modalConfirmButton).toBeDisplayed();
        await $modalConfirmButton.click(); // Confirm chart deletion.
        await expect($(`figcaption=${chartTitle}`)).not.toBeExisting(); // Check that the visualization box disappeared.
    });
});
