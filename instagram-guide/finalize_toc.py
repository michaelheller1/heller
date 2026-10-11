"""Fill the cached result of the Word TOC field so the table of contents is
visible even in viewers that do not update fields (Word still refreshes it).

usage: finalize_toc.py <docx> [rendered.pdf]
Without a PDF, page numbers are placeholders of the same width, so a first
render paginates exactly like the final document.
"""
import glob
import os
import re
import subprocess
import sys
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
TAB_POS = 8900  # inside the content width (9506 DXA) so two-digit page numbers stay on the line


def h1_titles():
    titles = []
    for path in sorted(glob.glob(os.path.join(HERE, 'content', '*.md'))):
        with open(path, encoding='utf-8') as f:
            titles += [line[2:].strip() for line in f if line.startswith('# ')]
    return titles


def letters(s):
    return re.sub(r'[^א-ת]', '', s)


def page_numbers(pdf, titles):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    pages, toc_pages = [], [0]
    for i in range(1, n + 1):
        txt = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), pdf, '-'], capture_output=True, text=True).stdout
        # Skip the running header line; a chapter title sits at the top of its page.
        lines = [l for l in txt.splitlines()[1:] if l.strip()]
        pages.append(letters(' '.join(lines[:3])))
        if i <= 8 and '.....' in txt:
            toc_pages.append(i)
    # Start after the table of contents, whose entries would otherwise match.
    result, start = [], max(toc_pages)
    for t in titles:
        # pdftotext may reorder mixed-direction runs, so match words, not the whole string.
        words = [letters(w) for w in t.split() if letters(w)]
        for i in range(start, n):
            if all(w in pages[i] for w in words):
                result.append(i + 1)
                start = i + 1
                break
        else:
            raise SystemExit(f'title not found in PDF: {t}')
    return result


def entry(title, page):
    rpr = '<w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:rtl/></w:rPr>'
    return (
        # CT_PPr child order matters for schema validity: tabs, then bidi, then spacing.
        '<w:p><w:pPr>'
        f'<w:tabs><w:tab w:val="left" w:leader="dot" w:pos="{TAB_POS}"/></w:tabs>'
        '<w:bidi/><w:spacing w:after="90"/></w:pPr>'
        f'<w:r>{rpr}<w:t xml:space="preserve">{escape(title)}</w:t></w:r>'
        f'<w:r>{rpr}<w:tab/></w:r>'
        f'<w:r>{rpr}<w:t>{page}</w:t></w:r></w:p>'
    )


def main():
    docx = sys.argv[1]
    titles = h1_titles()
    nums = page_numbers(sys.argv[2], titles) if len(sys.argv) > 2 else ['00'] * len(titles)
    with zipfile.ZipFile(docx) as z:
        items = {n: z.read(n) for n in z.namelist()}
    xml = items['word/document.xml'].decode('utf-8')
    sep = '<w:fldChar w:fldCharType="separate"/></w:r></w:p>'
    i = xml.index(sep) + len(sep)
    xml = xml[:i] + ''.join(entry(t, p) for t, p in zip(titles, nums)) + xml[i:]
    items['word/document.xml'] = xml.encode('utf-8')
    with zipfile.ZipFile(docx, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in items.items():
            z.writestr(n, data)
    print('TOC entries:', list(zip(titles, nums)))


if __name__ == '__main__':
    main()
