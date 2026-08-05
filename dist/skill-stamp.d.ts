/**
 * The skill and agent are copied into a project's `.claude/` directory, so they
 * are snapshots — a package upgrade cannot reach them. This stamp records which
 * version produced each copy, which is what makes staleness detectable instead
 * of silent.
 */
export interface SkillStamp {
    skill?: string;
    agent?: string;
}
export declare const STAMP_FILE = ".pw-tutorial-video.json";
export declare function stampPath(claudeDir: string): string;
export declare function readStamp(claudeDir: string): SkillStamp;
export declare function writeStamp(claudeDir: string, stamp: SkillStamp): void;
export declare function packageVersion(packageRoot: string): string;
/** What `init` would bring up to date, given what is on disk. */
export declare function outdated(claudeDir: string, version: string, installed: {
    skill: boolean;
    agent: boolean;
}): string[];
//# sourceMappingURL=skill-stamp.d.ts.map