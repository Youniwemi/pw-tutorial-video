import type { SiteConfig, VideoManifest, VideoManifestEntry } from './types.js';

/** One step of a widget payload. Display numbers are precomputed
 *  (sequential, contexts don't count) so the widget stays dumb. */
export interface EmbedStep {
	num?: number;
	title?: string;
	text?: string;
	/** Site-relative path, e.g. "videos/demo-step-1.webp" */
	image?: string;
	context?: boolean;
}

/** Payload served at embed/<id>.json — everything the in-app widget needs
 *  to render one tutorial. All paths are relative to the site base URL,
 *  which the widget derives from its own script src. */
export interface EmbedTutorial {
	id: string;
	title: string;
	description?: string;
	duration: string;
	variant?: string;
	lang: string;
	/** Site primary color — the widget's default accent */
	accent: string;
	/** Site-relative video path ("videos/<file>") */
	video: string;
	/** First step screenshot, used as the video poster */
	poster?: string;
	/** Site-relative path of the full tutorial page ("<id>/") */
	page: string;
	steps: EmbedStep[];
}

export interface EmbedIndex {
	tutorials: { id: string; title: string; duration: string; variant?: string }[];
}

export function buildEmbedTutorial(video: VideoManifestEntry, config: SiteConfig): EmbedTutorial {
	let counter = 0;
	const steps: EmbedStep[] = (video.stepsDetail ?? []).map((s) => ({
		...(s.context ? {} : { num: ++counter }),
		...(s.title ? { title: s.title } : {}),
		...(s.text ? { text: s.text } : {}),
		...(s.image ? { image: `videos/${s.image}` } : {}),
		...(s.context ? { context: true } : {})
	}));

	const poster = (video.stepsDetail ?? []).find((s) => s.image)?.image;

	return {
		id: video.id,
		title: video.title,
		...(video.description ? { description: video.description } : {}),
		duration: video.duration,
		...(video.variant ? { variant: video.variant } : {}),
		// config.lang may be a comma-separated list — the first entry is the site default
		lang: (config.lang || 'en').split(',')[0].trim(),
		accent: config.primaryColor || '#6366f1',
		video: `videos/${video.file}`,
		...(poster ? { poster: `videos/${poster}` } : {}),
		page: `${video.id}/`,
		steps
	};
}

/** All the JSON files the widget consumes: one payload per tutorial plus a
 *  small index (slug discovery / debugging). Paths are relative to the site
 *  root — scaffold writes them under public/. */
export function buildEmbedFiles(manifest: VideoManifest, config: SiteConfig): { path: string; data: EmbedTutorial | EmbedIndex }[] {
	const files: { path: string; data: EmbedTutorial | EmbedIndex }[] = manifest.videos.map((v) => ({
		path: `embed/${v.id}.json`,
		data: buildEmbedTutorial(v, config)
	}));

	const index: EmbedIndex = {
		tutorials: manifest.videos.map((v) => ({
			id: v.id,
			title: v.title,
			duration: v.duration,
			...(v.variant ? { variant: v.variant } : {})
		}))
	};
	files.push({ path: 'embed/index.json', data: index });

	return files;
}
