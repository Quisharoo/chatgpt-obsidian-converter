import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { convertConversationToMarkdown, processConversations } from '../../../src/modules/conversionEngine.js';

describe('Preferences integration (localStorage)', () => {
    const PREFS_KEY = 'chatgpt_md_prefs';

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('frontmatter can be disabled via preferences', () => {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ frontmatterEnabled: false }));
        const conversation = {
            title: 'No Frontmatter',
            create_time: 1703522622,
            mapping: {
                root: { message: { author: { role: 'user' }, content: { parts: ['Hello'] } }, children: [], parent: null }
            }
        };
        const md = convertConversationToMarkdown(conversation);
        expect(md.startsWith('---')).toBe(false);
    });

    test('filename preset zettelkasten is applied', () => {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ filenamePreset: 'zettel' }));
        const conversations = [
            {
                id: 'conv_z1',
                title: 'Zettel Note',
                create_time: 1703522622,
                mapping: {
                    root: { message: { author: { role: 'user' }, content: { parts: ['Content'] } }, children: [], parent: null }
                }
            }
        ];
        const results = processConversations(conversations);
        expect(results.files).toHaveLength(1);
        const name = results.files[0].filename;
        expect(name).toMatch(/^\d{12} Zettel Note\.md$/);
    });
});


