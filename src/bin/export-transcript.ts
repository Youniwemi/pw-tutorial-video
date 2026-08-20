#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import type { TimelineData } from '../timeline.js';
import { buildTranscriptMarkdown, parseTranscript, applyCorrections } from '../transcript.js';

const OUTPUT_DIR = process.env.TUTORIAL_OUTPUT_DIR || join(process.cwd(), 'tutorials/output');
const TRANSCRIPT_DIR = process.env.TUTORIAL_TRANSCRIPT_DIR || join(process.cwd(), 'tutorials/transcripts');

function findTimelineFiles(): string[] {
	const envPath = process.env.TUTORIAL_TRANSCRIPT;
	if (envPath) return [envPath];

	if (!existsSync(OUTPUT_DIR)) {
		console.error(`Output directory not found: ${OUTPUT_DIR}`);
		process.exit(1);
	}

	return readdirSync(OUTPUT_DIR)
		.filter(f => f.endsWith('_timeline.json'))
		.map(f => join(OUTPUT_DIR, f));
}

/** Regenerate transcript markdown files from timeline JSON (default command). */
function runExport(): void {
	const files = findTimelineFiles();

	if (files.length === 0) {
		console.log('No timeline JSON files found.');
		process.exit(0);
	}

	mkdirSync(TRANSCRIPT_DIR, { recursive: true });

	const written: string[] = [];

	for (const filePath of files) {
		const fileName = basename(filePath, '_timeline.json');
		const outPath = join(TRANSCRIPT_DIR, `${fileName}.md`);

		try {
			const data: TimelineData = JSON.parse(readFileSync(filePath, 'utf-8'));
			writeFileSync(outPath, buildTranscriptMarkdown(data), 'utf-8');
			written.push(outPath);
		} catch (err: any) {
			console.error(`Failed to process ${filePath}: ${err.message}`);
		}
	}

	console.log(`\nTranscripts written (${written.length}):`);
	for (const p of written) {
		console.log(`  ${p}`);
	}
}

/** Write edited transcript texts back into the test sources (`apply` command). */
function runApply(mdPaths: string[]): void {
	const targets = mdPaths.length > 0
		? mdPaths
		: existsSync(TRANSCRIPT_DIR)
			? readdirSync(TRANSCRIPT_DIR).filter(f => f.endsWith('.md')).map(f => join(TRANSCRIPT_DIR, f))
			: [];

	if (targets.length === 0) {
		console.log(`No transcript markdown files found in ${TRANSCRIPT_DIR}.`);
		process.exit(0);
	}

	let totalApplied = 0;
	let totalManual = 0;

	for (const mdPath of targets) {
		const name = basename(mdPath, '.md');
		const timelinePath = join(OUTPUT_DIR, `${name}_timeline.json`);

		if (!existsSync(timelinePath)) {
			console.error(`Skipping ${mdPath}: no matching timeline (${timelinePath})`);
			continue;
		}

		let data: TimelineData;
		let entries;
		try {
			data = JSON.parse(readFileSync(timelinePath, 'utf-8'));
			entries = parseTranscript(readFileSync(mdPath, 'utf-8'));
		} catch (err: any) {
			console.error(`Failed to read ${name}: ${err.message}`);
			continue;
		}

		const report = applyCorrections(data, entries, {
			read: (path) => (existsSync(path) ? readFileSync(path, 'utf-8') : null),
			write: (path, content) => writeFileSync(path, content, 'utf-8')
		});

		if (report.applied.length === 0 && report.manual.length === 0) continue;

		console.log(`\n${name}`);
		for (const change of report.applied) {
			console.log(`  ✔ ${change.kind}${change.key ? ` \`${change.key}\`` : ''} → ${change.file}`);
			console.log(`      "${change.from}"`);
			console.log(`    → "${change.to}"`);
		}
		for (const problem of report.manual) {
			console.log(`  ✖ ${problem.kind}${problem.key ? ` \`${problem.key}\`` : ''}: ${problem.reason}`);
			if (problem.from) console.log(`      wanted: "${problem.from}" → "${problem.to}"`);
		}

		// Keep the timeline JSON in sync so a second `apply` run is a no-op.
		if (report.timelineUpdated) {
			writeFileSync(timelinePath, JSON.stringify(data, null, 2));
		}

		totalApplied += report.applied.length;
		totalManual += report.manual.length;
	}

	console.log(`\n${totalApplied} correction(s) applied, ${totalManual} need manual attention.`);
	if (totalApplied > 0) {
		console.log('Re-run with TUTORIAL_MODE=true to regenerate audio and video.');
	}
}

const args = process.argv.slice(2);
if (args[0] === 'apply') {
	runApply(args.slice(1));
} else {
	runExport();
}
