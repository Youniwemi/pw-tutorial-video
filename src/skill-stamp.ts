import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

export const STAMP_FILE = '.pw-tutorial-video.json';

export function stampPath(claudeDir: string): string {
	return join(claudeDir, STAMP_FILE);
}

export function readStamp(claudeDir: string): SkillStamp {
	const path = stampPath(claudeDir);
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as SkillStamp;
	} catch {
		return {};
	}
}

export function writeStamp(claudeDir: string, stamp: SkillStamp): void {
	writeFileSync(stampPath(claudeDir), `${JSON.stringify(stamp, null, 2)}\n`);
}

export function packageVersion(packageRoot: string): string {
	try {
		return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8')).version ?? '0.0.0';
	} catch {
		return '0.0.0';
	}
}

/** What `init` would bring up to date, given what is on disk. */
export function outdated(
	claudeDir: string,
	version: string,
	installed: { skill: boolean; agent: boolean }
): string[] {
	const stamp = readStamp(claudeDir);
	const stale: string[] = [];
	if (installed.skill && stamp.skill !== version) stale.push('skill');
	if (installed.agent && stamp.agent !== version) stale.push('agent');
	return stale;
}
