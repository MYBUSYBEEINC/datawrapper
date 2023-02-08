/**
 * Returns true if the user has access to `path`.
 */
declare function hasAccess(path: string, mode?: number): Promise<boolean>;
export declare const fsUtils: {
    hasAccess: typeof hasAccess;
};
export {};
