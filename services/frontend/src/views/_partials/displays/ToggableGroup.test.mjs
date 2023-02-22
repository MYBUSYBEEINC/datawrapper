import ToggableGroup from './ToggableGroup.svelte';
import chai, { expect } from 'chai';
import chaiDom from 'chai-dom';
import { setConfig } from '../../../../tests/helpers/clientUtils';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

setConfig({ testIdAttribute: 'data-uid' });

chai.use(chaiDom);

describe('ToggableGroup', () => {
    it('toggles visibility on button click', async () => {
        const { getByTestId, queryByTestId } = render(ToggableGroup);

        const trigger = getByTestId('toggable-group-trigger');
        expect(trigger).to.exist;

        expect(queryByTestId('toggable-group-content')).to.not.exist;

        trigger.click();
        await tick();

        expect(queryByTestId('toggable-group-content')).to.exist;
    });

    it('does not toggle visibility when disabled', async () => {
        const { getByTestId, queryByTestId } = render(ToggableGroup, { disabled: true });

        const trigger = getByTestId('toggable-group-trigger');
        expect(trigger).to.exist;

        expect(queryByTestId('toggable-group-content')).to.not.exist;

        trigger.click();
        await tick();

        expect(queryByTestId('toggable-group-content')).to.not.exist;
    });

    it('is visible when the visible prop is true', () => {
        const { getByTestId } = render(ToggableGroup, { visible: true });
        expect(getByTestId('toggable-group-content')).to.exist;
    });
});
