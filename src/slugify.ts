/**
 * Build an SEO-friendly filename slug from a human-readable string.
 *
 * - NFD-normalize then drop every Unicode combining mark — this strips Latin
 *   diacritics (é→e) AND the hamza marks that NFD splits off Arabic letters
 *   (إ → ا + U+0655 → ا). Without the Arabic pass, titles like
 *   "إنشاء أول فاتورة" would emit stray dashes where the marks were.
 * - Lowercase (no-op on Arabic).
 * - Any run of non-letter/non-number → single dash.
 * - Leading / trailing dashes trimmed; consecutive dashes collapsed.
 *
 * Examples:
 *   "Créer votre première facture"  → "creer-votre-premiere-facture"
 *   "Set Up Your Company"           → "set-up-your-company"
 *   "إنشاء أول فاتورة"              → "انشاء-اول-فاتورة"
 *   "S'abonner avec BaridPay"       → "s-abonner-avec-baridpay"
 */
export function slugify(input: string): string {
	if (!input) return '';
	return input
		.normalize('NFD')
		.replace(/\p{M}+/gu, '') // strip ALL combining marks (Latin + Arabic hamza marks)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-') // any non-letter/number → dash
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '');
}
