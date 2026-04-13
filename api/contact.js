const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Resend } = require('resend');

// Grayling brand colours as rgb(0-1)
const NAVY   = rgb(0.059, 0.161, 0.298);  // #0F294C
const BLUE   = rgb(0.102, 0.451, 0.910);  // #1a73e8
const WHITE  = rgb(1, 1, 1);
const BLACK  = rgb(0.039, 0.039, 0.039);  // #0a0a0a
const MID    = rgb(0.420, 0.420, 0.408);  // #6b6b68
const SILVER = rgb(0.761, 0.769, 0.753);  // #c2c4c0
const POS    = rgb(0.102, 0.361, 0.227);  // #1a5c3a
const NEG    = rgb(0.478, 0.102, 0.102);  // #7a1a1a
const NEU    = rgb(0.102, 0.227, 0.361);  // #1a3a5c
const RULE   = rgb(0.847, 0.835, 0.808);  // #d8d5ce

function sentimentColor(s) {
  return s === 'positive' ? POS : s === 'negative' ? NEG : NEU;
}

// Draw a filled rectangle
function drawRect(page, x, y, w, h, color) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

// Draw text with options
function drawText(page, text, x, y, font, size, color, opts = {}) {
  page.drawText(String(text), { x, y, font, size, color, ...opts });
}

// Wrap text into lines that fit within maxWidth
function wrapText(text, font, size, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function buildPDF(contact, result) {
  const pdfDoc = await PDFDocument.create();

  const boldFont   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regFont    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const obFont     = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const W  = 595;
  const H  = 842;
  const M  = 48;
  const CW = W - M * 2;
  const FOOTER_H   = 56;
  const HEADER_H   = 120; // only on first page
  const SAFE_BOTTOM = FOOTER_H + 20; // don't draw below this (pdf-lib y from bottom)

  // ── Page manager ──
  // Tracks current page and top-down cursor (curY = distance from top of page)
  // On first page the header occupies the top 120px; continuation pages start fresh.
  let pages     = [];
  let curPage   = null;
  let curY      = 0; // top-down: distance from page top
  let isFirst   = true;

  function addPage() {
    const p = pdfDoc.addPage([W, H]);
    pages.push(p);
    curPage = p;
    if (isFirst) {
      curY    = HEADER_H; // skip header band
      isFirst = false;
    } else {
      curY = 24; // small top margin on continuation pages
    }
  }

  // Convert top-down y to pdf-lib bottom-up y
  const py = (topY) => H - topY;

  // Ensure there is at least lineH pixels left before SAFE_BOTTOM; start new page if not
  function ensureSpace(lineH) {
    if (py(curY + lineH) <= SAFE_BOTTOM) {
      drawFooter(curPage); // close current page with footer
      addPage();
    }
  }

  function drawFooter(page) {
    drawRect(page, 0, 0, W, FOOTER_H, NAVY);
    drawText(page, 'GRAYLING', M, 36, boldFont, 8, WHITE);
    const footerText = 'Public perception moves fast. Grayling helps you stay ahead of it, shape it, and turn it into advantage.';
    const footerLines = wrapText(footerText, regFont, 7.5, CW - 80);
    footerLines.forEach((line, i) => {
      drawText(page, line, M, 24 - i * 11, regFont, 7.5, BLUE);
    });
    drawText(page, 'www.grayling.com', W - M - 80, 18, regFont, 6.5, SILVER);
  }

  // ── Start first page ──
  addPage();
  isFirst = false; // already consumed header offset above, reset flag

  // ── HEADER BAND (first page only) ──
  const firstPage = pages[0];
  drawRect(firstPage, 0, py(HEADER_H), W, HEADER_H, NAVY);
  drawText(firstPage, 'GRAYLING', M, py(50), boldFont, 13, WHITE);
  drawText(firstPage, 'AI SENTIMENT INTELLIGENCE REPORT', M, py(64), regFont, 7, BLUE);
  const dateStr = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  drawText(firstPage, 'CONFIDENTIAL', W - M - 75, py(50), boldFont, 7, WHITE);
  drawText(firstPage, dateStr, W - M - 75, py(62), regFont, 7, SILVER);
  const entityText = (result.entity || '').toUpperCase();
  drawText(firstPage, entityText, M, py(96), boldFont, 24, WHITE);
  drawText(firstPage, (result.entity_type || '').toUpperCase(), M, py(114), regFont, 7, BLUE);

  // ── VERDICT BAND ──
  const sentCol = sentimentColor(result.overall_sentiment);
  drawRect(firstPage, 0, py(176), W, 56, sentCol);
  const sentLabel = (result.overall_sentiment || '').toUpperCase();
  drawText(firstPage, sentLabel, M, py(152), boldFont, 20, WHITE);
  drawText(firstPage, `${result.confidence}% confidence`, M + 140, py(158), regFont, 9, WHITE);

  // ── SCORE STRIP ──
  const stripTop = 176;
  const cellW = Math.floor(W / 3);
  const scores = [
    { label: 'POSITIVE SIGNAL', val: result.positive_score, col: POS },
    { label: 'NEGATIVE SIGNAL', val: result.negative_score, col: NEG },
    { label: 'NEUTRAL SIGNAL',  val: result.neutral_score,  col: NEU },
  ];
  scores.forEach((s, i) => {
    const x  = i * cellW;
    const bg = i % 2 === 0 ? rgb(0.961, 0.953, 0.933) : rgb(0.933, 0.922, 0.875);
    drawRect(firstPage, x, py(stripTop + 70), cellW, 70, bg);
    drawText(firstPage, `${Math.round(s.val)}%`, x + 16, py(stripTop + 36), boldFont, 24, s.col);
    drawText(firstPage, s.label, x + 16, py(stripTop + 54), regFont, 6, MID);
    drawRect(firstPage, x + 16, py(stripTop + 66), cellW - 32, 1, RULE);
    const fillW = Math.round(((cellW - 32) * s.val) / 100);
    if (fillW > 0) drawRect(firstPage, x + 16, py(stripTop + 66), fillW, 1.5, s.col);
    if (i > 0) drawRect(firstPage, x, py(stripTop + 70), 0.5, 70, RULE);
  });

  // Advance cursor past the score strip
  curY = stripTop + 86;

  // ── EDITORIAL VERDICT ──
  ensureSpace(30);
  drawText(curPage, 'EDITORIAL VERDICT', M, py(curY + 10), boldFont, 6.5, BLUE);
  drawRect(curPage, M, py(curY + 20), CW, 0.5, RULE);
  curY += 28;

  const headLines = wrapText(result.editorial_headline || '', boldFont, 13, CW);
  headLines.forEach(line => {
    ensureSpace(20);
    drawText(curPage, line, M, py(curY + 14), boldFont, 13, BLACK);
    curY += 18;
  });
  curY += 6;

  const bodyClean = (result.editorial_body || '').replace(/<[^>]+>/g, '');
  const bodyLines = wrapText(bodyClean, regFont, 9, CW);
  bodyLines.forEach(line => {
    ensureSpace(16);
    drawText(curPage, line, M, py(curY + 10), regFont, 9, MID);
    curY += 14;
  });
  curY += 20;

  // ── SOURCE VOICES ──
  ensureSpace(30);
  drawText(curPage, 'SOURCE VOICES', M, py(curY + 10), boldFont, 6.5, BLUE);
  drawRect(curPage, M, py(curY + 20), CW, 0.5, RULE);
  curY += 28;

  for (const v of (result.source_voices || [])) {
    ensureSpace(60);
    const vcol = sentimentColor(v.sentiment);
    drawText(curPage, (v.source || '').toUpperCase(), M, py(curY + 10), regFont, 7, MID);
    const badgeLabel = (v.sentiment || '').toUpperCase();
    drawRect(curPage, W - M - 55, py(curY + 12), 55, 13, WHITE);
    curPage.drawRectangle({ x: W - M - 55, y: py(curY + 12), width: 55, height: 13, borderColor: vcol, borderWidth: 0.8 });
    drawText(curPage, badgeLabel, W - M - 42, py(curY + 4), boldFont, 6, vcol);
    curY += 14;

    const quoteLines = wrapText(`"${v.quote || ''}"`, obFont, 8.5, CW - 60);
    quoteLines.forEach(line => {
      ensureSpace(15);
      drawText(curPage, line, M, py(curY + 10), obFont, 8.5, BLACK);
      curY += 13;
    });

    ensureSpace(24);
    drawText(curPage, `Audience: ${v.audience || ''}`, M, py(curY + 8), regFont, 6.5, SILVER);
    curY += 14;
    drawRect(curPage, M, py(curY), CW, 0.5, rgb(0.910, 0.898, 0.871));
    curY += 10;
  }
  curY += 10;

  // ── THEMES ──
  ensureSpace(60);
  drawText(curPage, 'KEY THEMES', M, py(curY + 10), boldFont, 6.5, BLUE);
  drawRect(curPage, M, py(curY + 20), CW, 0.5, RULE);
  curY += 28;

  const colW = Math.floor(CW / 2) - 8;
  drawText(curPage, 'POSITIVE DRIVERS', M, py(curY + 10), boldFont, 7, POS);
  drawText(curPage, 'NEGATIVE DRIVERS', M + colW + 16, py(curY + 10), boldFont, 7, NEG);
  curY += 18;

  const posT = result.positive_themes || [];
  const negT = result.negative_themes || [];
  const maxT = Math.max(posT.length, negT.length);

  for (let i = 0; i < maxT; i++) {
    ensureSpace(18);
    if (posT[i]) drawText(curPage, `+  ${posT[i]}`, M, py(curY + 10), regFont, 8.5, BLACK);
    if (negT[i]) drawText(curPage, `-  ${negT[i]}`, M + colW + 16, py(curY + 10), regFont, 8.5, BLACK);
    curY += 16;
  }
  curY += 14;

  // ── SUMMARY NOTE ──
  ensureSpace(40);
  drawRect(curPage, M, py(curY), CW, 0.5, RULE);
  curY += 14;
  const sumLines = wrapText(`"${result.summary_note || ''}"`, obFont, 10, CW);
  sumLines.forEach(line => {
    ensureSpace(18);
    drawText(curPage, line, M, py(curY + 12), obFont, 10, MID);
    curY += 16;
  });
  curY += 10;

  // ── CONTACT DETAILS ──
  ensureSpace(80);
  drawRect(curPage, M, py(curY), CW, 0.5, RULE);
  curY += 14;
  drawText(curPage, 'REQUESTED BY', M, py(curY + 10), boldFont, 6.5, BLUE);
  curY += 16;
  drawText(curPage, contact.name || '', M, py(curY + 10), boldFont, 9, BLACK);
  curY += 14;
  drawText(curPage, `${contact.title || ''}, ${contact.company || ''}`, M, py(curY + 10), regFont, 8.5, MID);
  curY += 13;
  drawText(curPage, contact.email || '', M, py(curY + 10), regFont, 8.5, MID);

  // ── FOOTER on all pages ──
  pages.forEach(drawFooter);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const { contact, result } = req.body;

  if (!contact?.name || !contact?.email || !result) {
    return res.status(400).json({ error: 'Missing contact details or report data' });
  }

  try {
    const pdfBuffer = await buildPDF(contact, result);
    const pdfBase64 = pdfBuffer.toString('base64');

    const resend = new Resend(resendKey);
    const entitySlug = (result.entity || 'entity').replace(/\s+/g, '-').toLowerCase();
    const filename = `grayling-sentiment-${entitySlug}.pdf`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Grayling Sentiment Analyser <onboarding@resend.dev>',
      to: 'srividhyadarshya@gmail.com',
      subject: `Sentiment Report Request: ${result.entity} - ${contact.name}, ${contact.company}`,
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#0F294C;padding:28px 32px 20px;">
            <p style="color:#fff;font-size:13px;font-weight:bold;letter-spacing:3px;margin:0 0 4px;">GRAYLING</p>
            <p style="color:#1a73e8;font-size:9px;letter-spacing:2px;margin:0;">AI SENTIMENT INTELLIGENCE</p>
          </div>
          <div style="padding:28px 32px;border:1px solid #e8e5de;border-top:none;">
            <p style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">New Report Request</p>
            <p style="font-size:18px;font-weight:bold;margin:0 0 4px;">${contact.name}</p>
            <p style="font-size:13px;color:#6b6b68;margin:0 0 2px;">${contact.title} at ${contact.company}</p>
            <p style="font-size:13px;color:#1a73e8;margin:0 0 24px;">${contact.email}</p>
            <hr style="border:none;border-top:1px solid #e8e5de;margin:0 0 20px;">
            <p style="font-size:11px;color:#999;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">Entity Analysed</p>
            <p style="font-size:20px;font-weight:bold;margin:0 0 4px;">${result.entity}</p>
            <p style="font-size:11px;color:#6b6b68;margin:0 0 20px;">${result.entity_type}</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e8e5de;">
                  <span style="font-size:9px;letter-spacing:1.5px;color:#999;text-transform:uppercase;">Overall</span><br>
                  <span style="font-size:16px;font-weight:bold;color:${result.overall_sentiment==='positive'?'#1a5c3a':result.overall_sentiment==='negative'?'#7a1a1a':'#1a3a5c'}">${(result.overall_sentiment||'').toUpperCase()}</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #e8e5de;">
                  <span style="font-size:9px;letter-spacing:1.5px;color:#999;text-transform:uppercase;">Confidence</span><br>
                  <span style="font-size:16px;font-weight:bold;">${result.confidence}%</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #e8e5de;">
                  <span style="font-size:9px;letter-spacing:1.5px;color:#999;text-transform:uppercase;">Positive</span><br>
                  <span style="font-size:16px;font-weight:bold;color:#1a5c3a;">${result.positive_score}%</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #e8e5de;">
                  <span style="font-size:9px;letter-spacing:1.5px;color:#999;text-transform:uppercase;">Negative</span><br>
                  <span style="font-size:16px;font-weight:bold;color:#7a1a1a;">${result.negative_score}%</span>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#6b6b68;line-height:1.6;margin:0;">The full Grayling Sentiment Intelligence Report is attached as a PDF.</p>
          </div>
          <div style="background:#0F294C;padding:18px 32px;">
            <p style="color:#1a73e8;font-size:9px;letter-spacing:1.5px;margin:0;">Public perception moves fast. Grayling helps you stay ahead of it, shape it, and turn it into advantage.</p>
          </div>
        </div>
      `,
      attachments: [{ filename, content: pdfBase64, type: 'application/pdf' }]
    });

    if (emailError) {
      console.error('Resend error:', JSON.stringify(emailError));
      return res.status(500).json({ error: 'Email failed: ' + (emailError.message || JSON.stringify(emailError)) });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, emailId: emailData?.id });

  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
