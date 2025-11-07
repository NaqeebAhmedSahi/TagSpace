/**
 * Simple DOCX/ODT/RTF parser using mammoth (for docx) and fallback text extraction.
 * Returns { text, links, numPages }
 */
import AppConfig from '-/AppConfig';

export async function extractDocContent(
  arrayBuffer: ArrayBuffer,
  progressCallback?: (progress: number) => void,
): Promise<{ text: string; links: Array<{ url: string; text: string }>; numPages: number }> {
  const links: Array<{ url: string; text: string }> = [];
  let text = '';
  let numPages = 1;

  if (!arrayBuffer) return { text: '', links, numPages };

  try {
    // Dynamically require mammoth to avoid bundling issues in some build targets
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');

    // mammoth.convertToHtml accepts an ArrayBuffer in the browser env
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result && result.value ? result.value : '';

    // Use DOM to extract text and links (renderer has DOM)
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    text = tmp.innerText || tmp.textContent || '';

    const anchorEls = tmp.getElementsByTagName('a');
    for (let i = 0; i < anchorEls.length; i += 1) {
      const a = anchorEls[i];
      const href = a.getAttribute('href') || a.href || '';
      const label = a.textContent || href;
      if (href && !links.some((l) => l.url === href)) {
        links.push({ url: href, text: label });
      }
    }

    // mammoth does not provide page numbers; keep numPages = 1
    numPages = 1;
  } catch (e) {
    console.warn('extractDocContent: mammoth parse failed, falling back to plain text', e);
    // Fallback: attempt to decode as UTF-8 text
    try {
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(arrayBuffer);
    } catch (err) {
      console.error('extractDocContent fallback failed:', err);
      text = '';
    }
  }

  return { text, links, numPages };
}

export default extractDocContent;
