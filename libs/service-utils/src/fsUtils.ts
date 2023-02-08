import fs from 'fs/promises';

/**
 * Returns true if the user has access to `path`.
 */
async function hasAccess(path: string, mode?: number): Promise<boolean> {
    try {
        await fs.access(path, mode);
        return true;
    } catch (e) {
        // ENOENT goes here
        return false;
    }
}

export const fsUtils = {
    hasAccess
};
