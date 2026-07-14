import type { ContextStyle } from './types';

export const CURSOR_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
	<path d="M4 4L10.5 20.5L13 13L20.5 10.5L4 4Z" fill="white" stroke="var(--tutorial-cursor-stroke, #1e293b)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const CONTEXT_ICONS: Record<ContextStyle, string> = {
	goal: '\uD83C\uDFAF',
	clarification: '\uD83D\uDCA1',
	attention: '\u26A0\uFE0F'
};

export interface StepOverlayParams {
	tutorialTitle: string;
	step: number;
	title: string;
	description?: string;
	isRtl?: boolean;
	progressPercent?: number;
}

export function renderStepOverlay(params: StepOverlayParams): string {
	const { tutorialTitle, step, title, description, isRtl, progressPercent = 0 } = params;
	const rtlClass = isRtl ? 'tutorial-overlay-rtl' : '';

	return `<div id="tutorial-overlay" class="tutorial-overlay ${rtlClass}">
	<div class="tutorial-header">
		<span class="tutorial-icon">\uD83D\uDCCC</span>
		<h3 class="tutorial-title">${tutorialTitle}</h3>
		<span class="tutorial-step-badge">Step ${step}</span>
	</div>
	<h4 class="tutorial-step-title">${title}</h4>
	${description ? `<p class="tutorial-step-description">${description}</p>` : ''}
	${progressPercent > 0 ? `<div class="tutorial-progress"><div class="tutorial-progress-bar" style="width: ${progressPercent}%"></div></div>` : ''}
</div>`;
}

export interface ContextOverlayParams {
	tutorialTitle: string;
	contextTitle: string;
	text?: string;
	style: ContextStyle;
	isRtl?: boolean;
}

export function renderContextOverlay(params: ContextOverlayParams): string {
	const { tutorialTitle, contextTitle, text, style, isRtl } = params;
	const icon = CONTEXT_ICONS[style];
	const rtlClass = isRtl ? 'tutorial-overlay-rtl' : '';

	return `<div id="tutorial-overlay" class="tutorial-overlay tutorial-overlay-context tutorial-context-${style} ${rtlClass}">
	<div class="tutorial-header">
		<span class="tutorial-icon">${icon}</span>
		<h3 class="tutorial-title">${tutorialTitle}</h3>
	</div>
	<h4 class="tutorial-step-title">${contextTitle}</h4>
	${text ? `<p class="tutorial-context-text">${text}</p>` : ''}
</div>`;
}

export interface CompleteOverlayParams {
	title: string;
	message: string;
}

export function renderCompleteOverlay(params: CompleteOverlayParams): string {
	const { title, message } = params;

	return `<div id="tutorial-overlay" class="tutorial-overlay">
	<div class="tutorial-header">
		<span class="tutorial-icon">\u2705</span>
		<h3 class="tutorial-title">${title}</h3>
	</div>
	<h4 class="tutorial-step-title">${message}</h4>
	<div class="tutorial-progress"><div class="tutorial-progress-bar" style="width: 100%"></div></div>
</div>`;
}

export interface EmailPreviewParams {
	subject: string;
	from?: string;
	to?: string;
	body: string;
	highlightCode?: string;
	isRtl?: boolean;
}

export function renderEmailPreview(params: EmailPreviewParams): string {
	const { subject, from, to, body, highlightCode, isRtl } = params;
	const rtlClass = isRtl ? 'tutorial-overlay-rtl' : '';

	let displayBody = body;
	if (highlightCode) {
		const highlightStyle = `
			<style>
				.tutorial-code-highlight {
					background: #fff3cd !important;
					color: #856404 !important;
					padding: 4px 12px !important;
					border-radius: 4px !important;
					font-weight: 700 !important;
					font-size: 18px !important;
					letter-spacing: 2px !important;
					display: inline-block !important;
					margin: 8px 0 !important;
					border: 2px solid #ffc107 !important;
					animation: pulse 1.5s ease-in-out infinite !important;
				}
				@keyframes pulse {
					0%, 100% { box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.3); }
					50% { box-shadow: 0 0 0 8px rgba(255, 193, 7, 0.5), 0 0 20px rgba(255, 193, 7, 0.3); }
				}
			</style>
		`;
		displayBody = highlightStyle + body.replace(
			new RegExp(`(${highlightCode})`, 'g'),
			`<span class="tutorial-code-highlight">$1</span>`
		);
	}

	// Render inside an iframe via srcdoc so the email's own CSS doesn't collide
	// with the app stylesheet (was causing missing icons / broken layout) and so
	// images with absolute URLs load normally. `srcdoc` is same-origin, so the
	// scroll animation in Tutorial.ts can still access the iframe body.
	const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
		html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #333; background: #fff; }
		body { padding: 16px; }
		img { max-width: 100%; height: auto; }
	</style></head><body>${displayBody}</body></html>`;

	const srcdocAttr = srcdoc.replace(/"/g, '&quot;');

	return `<div id="tutorial-email-preview" class="tutorial-email-preview ${rtlClass}">
	<div class="tutorial-email-window">
		<div class="tutorial-email-titlebar">
			<span class="tutorial-email-dot red"></span>
			<span class="tutorial-email-dot yellow"></span>
			<span class="tutorial-email-dot green"></span>
			<span class="tutorial-email-app">\uD83D\uDCE7 Email</span>
		</div>
		<div class="tutorial-email-header">
			${from ? `<div class="tutorial-email-field"><strong>From:</strong> ${from}</div>` : ''}
			${to ? `<div class="tutorial-email-field"><strong>To:</strong> ${to}</div>` : ''}
			<div class="tutorial-email-field"><strong>Subject:</strong> ${subject}</div>
		</div>
		<div class="tutorial-email-body-container">
			<iframe class="tutorial-email-body tutorial-email-iframe" srcdoc="${srcdocAttr}" sandbox="allow-same-origin"></iframe>
		</div>
	</div>
</div>`;
}
