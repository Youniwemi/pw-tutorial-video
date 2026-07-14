import { renderStepOverlay, renderContextOverlay, renderCompleteOverlay, renderEmailPreview } from './overlay-html.js';
export class TutorialOverlay {
    page;
    options;
    currentStep = 0;
    totalSteps = 0;
    constructor(page, options) {
        this.page = page;
        this.options = options;
    }
    switchPage(page) {
        this.page = page;
    }
    setTotalSteps(total) {
        this.totalSteps = total;
    }
    setCurrentStep(step) {
        this.currentStep = step;
    }
    incrementStep() {
        return ++this.currentStep;
    }
    get step() {
        return this.currentStep;
    }
    async showStep(title, description) {
        const isRtl = this.options.lang === 'ar';
        const progressPercent = this.totalSteps > 0 ? (this.currentStep / this.totalSteps) * 100 : 0;
        const html = renderStepOverlay({
            tutorialTitle: this.options.title,
            step: this.currentStep,
            title,
            description,
            isRtl,
            progressPercent
        });
        await this.page.evaluate((html) => {
            const existing = document.getElementById('tutorial-overlay');
            if (existing)
                existing.remove();
            const container = document.createElement('div');
            container.innerHTML = html;
            const overlay = container.firstElementChild;
            document.body.appendChild(overlay);
        }, html);
    }
    async showContext(contextTitle, text, style = 'goal') {
        const isRtl = this.options.lang === 'ar';
        const html = renderContextOverlay({
            tutorialTitle: this.options.title,
            contextTitle,
            text,
            style,
            isRtl
        });
        await this.page.evaluate((html) => {
            const existing = document.getElementById('tutorial-overlay');
            if (existing)
                existing.remove();
            const container = document.createElement('div');
            container.innerHTML = html;
            const overlay = container.firstElementChild;
            document.body.appendChild(overlay);
        }, html);
    }
    async showComplete(message) {
        const html = renderCompleteOverlay({
            title: this.options.title,
            message
        });
        await this.page.evaluate((html) => {
            const overlay = document.getElementById('tutorial-overlay');
            if (overlay) {
                const container = document.createElement('div');
                container.innerHTML = html;
                const newOverlay = container.firstElementChild;
                overlay.replaceWith(newOverlay);
            }
        }, html);
    }
    /**
     * Show a simulated email preview popup with HTML rendering
     */
    async showEmailPreview(options) {
        const isRtl = this.options.lang === 'ar';
        const html = renderEmailPreview({
            subject: options.subject,
            from: options.from,
            to: options.to,
            body: options.body,
            highlightCode: options.highlightCode,
            isRtl
        });
        await this.page.evaluate((html) => {
            const existing = document.getElementById('tutorial-email-preview');
            if (existing)
                existing.remove();
            const container = document.createElement('div');
            container.innerHTML = html;
            const preview = container.firstElementChild;
            document.body.appendChild(preview);
        }, html);
    }
    async hideEmailPreview() {
        await this.page.evaluate(() => {
            const preview = document.getElementById('tutorial-email-preview');
            if (preview)
                preview.remove();
        });
    }
    async hide() {
        await this.page.evaluate(() => {
            const overlay = document.getElementById('tutorial-overlay');
            if (overlay)
                overlay.remove();
        });
    }
    async highlight(selector, duration) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        await locator.evaluate((el) => el.classList.add('tutorial-highlight'));
        await this.page.waitForTimeout(duration ?? this.options.highlightDuration);
    }
    async unhighlight(selector) {
        const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
        try {
            await locator.evaluate((el) => el.classList.remove('tutorial-highlight'), null, { timeout: 2000 });
        }
        catch {
            // Element may have been removed after click (dialog closed, navigation, etc.)
        }
    }
}
//# sourceMappingURL=overlay.js.map