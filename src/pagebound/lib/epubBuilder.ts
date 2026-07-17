import JSZip from 'jszip';
import type { BookState } from '../types/book';
import { resolveCoverImageDataUrl, mimeTypeFromDataUrl } from './coverGenerator';
import { escapeXml } from './shared';
import { buildExportUnits } from './exportUnits';

function paragraphsToXhtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${escapeXml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// File extension for a given mime type, for the cover file written into the EPUB.
function extensionForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

const STYLE_CSS = `
body { font-family: Georgia, serif; line-height: 1.6; margin: 1.5em; color: #1c1b19; }
h1 { font-size: 1.8em; margin-bottom: 0.2em; }
h2.subtitle { font-weight: normal; font-style: italic; color: #6b2737; margin-top: 0; }
p { margin: 0 0 1em 0; text-indent: 1.2em; }
p:first-of-type { text-indent: 0; }
.title-page { text-align: center; margin-top: 30%; }
.index-term { font-weight: bold; }
`;

export async function buildEpub(book: BookState): Promise<Blob> {
  const zip = new JSZip();
  const uid = `pagebound-${Date.now()}`;

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  zip.folder('META-INF')!.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder('OEBPS')!;
  oebps.file('styles.css', STYLE_CSS);

  // Cover image — mime type/extension reflect what resolveCoverImageDataUrl
  // actually returned (JPEG for a generated cover, whatever format the
  // author uploaded for a custom one), not hardcoded to PNG.
  const coverDataUrl = await resolveCoverImageDataUrl(book.cover);
  const coverMime = mimeTypeFromDataUrl(coverDataUrl);
  const coverExt = extensionForMime(coverMime);
  const coverFilename = `cover.${coverExt}`;
  oebps.file(coverFilename, dataUrlToUint8Array(coverDataUrl), { base64: false, binary: true });

  oebps.file(
    'cover.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Cover</title><style>body{margin:0;padding:0;} img{width:100%;height:100%;object-fit:cover;}</style></head>
<body><img src="${coverFilename}" alt="Cover"/></body>
</html>`
  );

  const manifestItems: string[] = [
    `<item id="cover-img" href="${coverFilename}" media-type="${coverMime}" properties="cover-image"/>`,
    `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
  ];
  const spineItems: string[] = [`<itemref idref="cover" linear="no"/>`];
  const navItems: string[] = [];

  if (book.introduction) {
    oebps.file(
      'introduction.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Introduction</title><link rel="stylesheet" href="styles.css"/></head>
<body><h1>Introduction</h1>${paragraphsToXhtml(book.introduction)}</body>
</html>`
    );
    manifestItems.push(`<item id="intro" href="introduction.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="intro"/>`);
    navItems.push(`<li><a href="introduction.xhtml">Introduction</a></li>`);
  }

  // Chapters — one spine item per export unit (a group's concatenated
  // content for large manuscripts, or one per chapter for normal-sized
  // ones), not per raw detected chapter. A manuscript grouped into 50
  // navigable sections in the app previously still exported 1,200+
  // separate spine items and TOC entries, one per tiny raw chapter.
  const units = buildExportUnits(book);
  for (const unit of units) {
    oebps.file(
      `chapter-${unit.number}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(unit.title)}</title><link rel="stylesheet" href="styles.css"/></head>
<body><h1>${escapeXml(unit.title)}</h1>${paragraphsToXhtml(unit.body)}</body>
</html>`
    );
    manifestItems.push(
      `<item id="chapter-${unit.number}" href="chapter-${unit.number}.xhtml" media-type="application/xhtml+xml"/>`
    );
    spineItems.push(`<itemref idref="chapter-${unit.number}"/>`);
    navItems.push(`<li><a href="chapter-${unit.number}.xhtml">${escapeXml(unit.title)}</a></li>`);
  }

  // Index
  if (book.indexEntries.length > 0) {
    const indexBody = book.indexEntries
      .map(
        (e) =>
          `<p><span class="index-term">${escapeXml(e.term)}</span> — ${e.chapterNumbers
            .map((n) => `Ch. ${n}`)
            .join(', ')}</p>`
      )
      .join('\n');
    oebps.file(
      'index.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Index</title><link rel="stylesheet" href="styles.css"/></head>
<body><h1>Index</h1>${indexBody}</body>
</html>`
    );
    manifestItems.push(`<item id="index" href="index.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="index"/>`);
    navItems.push(`<li><a href="index.xhtml">Index</a></li>`);
  }

  // Nav (EPUB3 TOC)
  oebps.file(
    'nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title><link rel="stylesheet" href="styles.css"/></head>
<body>
  <nav epub:type="toc" id="toc"><h1>Table of Contents</h1><ol>${navItems.join('\n')}</ol></nav>
</body>
</html>`
  );
  manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);
  spineItems.push(`<itemref idref="nav" linear="no"/>`);

  // OPF package file
  oebps.file(
    'content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeXml(book.meta.title || 'Untitled')}</dc:title>
    <dc:creator>${escapeXml(book.meta.author || 'Unknown Author')}</dc:creator>
    <dc:language>${book.meta.language || 'en'}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
    <item id="css" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`
  );

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
