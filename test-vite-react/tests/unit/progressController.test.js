import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { ProgressController } from '../../../src/modules/ui/progressController.js';

describe('ProgressController', () => {
    let conversionDisplay;
    let saveDisplay;
    let accessibility;
    let controller;

    beforeEach(() => {
        conversionDisplay = {
            show: jest.fn(),
            updateProgress: jest.fn(),
            showError: jest.fn(),
            hide: jest.fn(),
            isVisible: false
        };

        saveDisplay = {
            show: jest.fn(),
            updateProgress: jest.fn(),
            showError: jest.fn(),
            hide: jest.fn(),
            setCancelCallback: jest.fn(),
            isVisible: false
        };

        accessibility = {
            announceProgress: jest.fn(),
            announceStatus: jest.fn()
        };

        controller = new ProgressController({
            conversionDisplay,
            saveDisplay,
            accessibility
        });
    });

    test('startConversion shows conversion display', () => {
        controller.startConversion();
        expect(conversionDisplay.show).toHaveBeenCalledWith(false, false);
    });

    test('updateConversion relays progress and accessibility message', () => {
        controller.updateConversion(25, 'Reading file');
        expect(conversionDisplay.updateProgress).toHaveBeenCalledWith(25, 'Reading file');
        expect(accessibility.announceProgress).toHaveBeenCalledWith('Reading file', 25);
    });

    test('completeConversion forces 100 percent update', () => {
        controller.completeConversion('Done');
        expect(conversionDisplay.updateProgress).toHaveBeenCalledWith(100, 'Done');
    });

    test('failConversion forwards error and announces status', () => {
        controller.failConversion('Boom');
        expect(conversionDisplay.showError).toHaveBeenCalledWith('Boom');
        expect(accessibility.announceStatus).toHaveBeenCalledWith('Boom', 'error');
    });

    test('hideConversion hides conversion display', () => {
        controller.startConversion();
        controller.hideConversion();
        expect(conversionDisplay.hide).toHaveBeenCalled();
    });

    test('startSaveOperation wires cancel callback and shows display', () => {
        const cancelSpy = jest.fn();
        controller.startSaveOperation(cancelSpy);
        expect(saveDisplay.setCancelCallback).toHaveBeenCalledWith(cancelSpy);
        expect(saveDisplay.show).toHaveBeenCalledWith(true, true);
    });

    test('updateSave relays save progress and accessibility message', () => {
        controller.updateSave(60, 'Saving files');
        expect(saveDisplay.updateProgress).toHaveBeenCalledWith(60, 'Saving files');
        expect(accessibility.announceProgress).toHaveBeenCalledWith('Saving files', 60);
    });

    test('completeSave sets final progress and clears callback', () => {
        controller.completeSave('Saved');
        expect(saveDisplay.updateProgress).toHaveBeenCalledWith(100, 'Saved');
        expect(saveDisplay.setCancelCallback).toHaveBeenCalledWith(null);
    });

    test('failSave displays error, clears callback, and announces status', () => {
        controller.failSave('Permissions missing');
        expect(saveDisplay.showError).toHaveBeenCalledWith('Permissions missing');
        expect(saveDisplay.setCancelCallback).toHaveBeenCalledWith(null);
        expect(accessibility.announceStatus).toHaveBeenCalledWith('Permissions missing', 'error');
    });

    test('hideSave hides save display with default timing', () => {
        controller.startSaveOperation();
        controller.hideSave();
        expect(saveDisplay.hide).toHaveBeenCalled();
    });

    test('displayStatus targets active display and announces status', () => {
        controller.startConversion();
        conversionDisplay.isVisible = true;
        controller.displayStatus('All good', 'info');
        expect(conversionDisplay.updateProgress).toHaveBeenCalledWith(100, 'All good');
        expect(accessibility.announceStatus).toHaveBeenCalledWith('All good', 'info');
    });
});
