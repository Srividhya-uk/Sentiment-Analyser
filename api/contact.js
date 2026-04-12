import PDFDocument from 'pdfkit';
import { Resend } from 'resend';

// Grayling brand colours
const NAVY   = '#0F294C';
const BLUE   = '#1a73e8';
const BLACK  = '#0a0a0a';
const MID    = '#6b6b68';
const POS    = '#1a5c3a';
const NEG    = '#7a1a1a';
const NEU    = '#1a3a5c';
const RULE   = '#d8d5ce';
const WHITE  = '#ffffff';

// hex to rgb array helper
function hex(h) {
  const r = parseInt(h.slice(1,3),16);
  const g = parseInt(h.slice(3,5),16);
  const b = parseInt(h.slice(5,7),16);
  return [r,g,b];
}

function buildPDF(contact, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // 595
    const H = doc.page.height;  // 842
    const M = 48;               // margin

    // ── HEADER BAND ──
    doc.rect(0, 0, W, 120).fill(hex(NAVY));

    // Grayling wordmark
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(13)
       .text('GRAYLING', M, 36, { characterSpacing: 4 });

    // Report type
    doc.fillColor(hex(BLUE)).font('Helvetica').fontSize(7)
       .text('AI SENTIMENT INTELLIGENCE REPORT', M, 54, { characterSpacing: 2 });

    // Confidential tag top right
    doc.fillColor(WHITE).font('Helvetica').fontSize(7)
       .text('CONFIDENTIAL', W - M - 80, 36, { characterSpacing: 2 });

    // Date
    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    doc.fillColor(hex(RULE)).font('Helvetica').fontSize(7)
       .text(dateStr, W - M - 80, 50);

    // Entity name large
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(28)
       .text(result.entity.toUpperCase(), M, 72, { characterSpacing: 1 });

    // Entity type small
    doc.fillColor(hex(BLUE)).font('Helvetica').fontSize(8)
       .text(result.entity_type.toUpperCase(), M, 105, { characterSpacing: 2 });

    // ── OVERALL VERDICT BAND ──
    const sentCol = result.overall_sentiment === 'positive' ? POS
                  : result.overall_sentiment === 'negative' ? NEG : NEU;

    doc.rect(0, 120, W, 56).fill(hex(sentCol));

    const sentLabel = result.overall_sentiment.toUpperCase();
    const sentIcon  = result.overall_sentiment === 'positive' ? '\u2191'
                    : result.overall_sentiment === 'negative' ? '\u2193' : '\u2192';

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22)
       .text(`${sentIcon}  ${sentLabel}`, M, 133);

    doc.fillColor(WHITE).font('Helvetica').fontSize(9)
       .text(`${result.confidence}% confidence`, M + 130, 140);

    // ── SCORE STRIP ──
    const stripY = 176;
    const cellW  = W / 3;

    const scores = [
      { label: 'POSITIVE SIGNAL', val: result.positive_score, col: POS },
      { label: 'NEGATIVE SIGNAL', val: result.negative_score, col: NEG },
      { label: 'NEUTRAL SIGNAL',  val: result.neutral_score,  col: NEU },
    ];

    scores.forEach((s, i) => {
      const x = i * cellW;
      // cell bg alternate
      doc.rect(x, stripY, cellW, 70)
         .fill(i % 2 === 0 ? hex('#f5f3ee') : hex('#eee9df'));

      // score number
      doc.fillColor(hex(s.col)).font('Helvetica-Bold').fontSize(28)
         .text(`${s.val}%`, x + 16, stripY + 10, { width: cellW - 32 });

      // label
      doc.fillColor(hex(MID)).font('Helvetica').fontSize(6.5)
         .text(s.label, x + 16, stripY + 46, { characterSpacing: 1.5, width: cellW - 32 });

      // bar track
      doc.rect(x + 16, stripY + 60, cellW - 32, 1).fill(hex(RULE));
      // bar fill
      const fillW = Math.round(((cellW - 32) * s.val) / 100);
      doc.rect(x + 16, stripY + 60, fillW, 1).fill(hex(s.col));
    });

    // vertical dividers
    doc.rect(cellW,     stripY, 0.5, 70).fill(hex(RULE));
    doc.rect(cellW * 2, stripY, 0.5, 70).fill(hex(RULE));

    // ── EDITORIAL VERDICT ──
    let y = stripY + 86;

    doc.fillColor(hex(BLUE)).font('Helvetica-Bold').fontSize(6.5)
       .text('EDITORIAL VERDICT', M, y, { characterSpacing: 2 });

    doc.rect(M, y + 14, W - M * 2, 0.5).fill(hex(RULE));
    y += 22;

    doc.fillColor(hex(BLACK)).font('Helvetica-Bold').fontSize(13)
       .text(result.editorial_headline, M, y, { width: W - M * 2 });

    y += doc.heightOfString(result.editorial_headline, { width: W - M * 2, fontSize: 13 }) + 10;

    const editBodyClean = (result.editorial_body || '').replace(/<[^>]+>/g, '');
    doc.fillColor(hex(MID)).font('Helvetica').fontSize(9).lineGap(3)
       .text(editBodyClean, M, y, { width: W - M * 2 });

    y += doc.heightOfString(editBodyClean, { width: W - M * 2, fontSize: 9 }) + 24;

    // ── SOURCE VOICES ──
    doc.fillColor(hex(BLUE)).font('Helvetica-Bold').fontSize(6.5)
       .text('SOURCE VOICES', M, y, { characterSpacing: 2 });
    doc.rect(M, y + 14, W - M * 2, 0.5).fill(hex(RULE));
    y += 22;

    const voices = result.source_voices || [];
    voices.forEach((v, i) => {
      if (y > H - 160) { doc.addPage(); y = M; }

      const vcol = v.sentiment === 'positive' ? POS
                 : v.sentiment === 'negative' ? NEG : NEU;

      // source name + badge
      doc.fillColor(hex(MID)).font('Helvetica').fontSize(7)
         .text(v.source.toUpperCase(), M, y, { characterSpacing: 1.2 });

      const badgeLabel = v.sentiment.toUpperCase();
      const badgeX = W - M - 50;
      doc.rect(badgeX, y - 2, 50, 12).stroke(hex(vcol));
      doc.fillColor(hex(vcol)).font('Helvetica-Bold').fontSize(6)
         .text(badgeLabel, badgeX + 2, y + 1, { width: 46, align: 'center', characterSpacing: 1 });

      y += 14;
      doc.fillColor(hex(BLACK)).font('Helvetica-Oblique').fontSize(8.5).lineGap(2)
         .text(`"${v.quote}"`, M, y, { width: W - M * 2 - 60 });

      y += doc.heightOfString(`"${v.quote}"`, { width: W - M * 2 - 60, fontSize: 8.5 }) + 4;

      doc.fillColor(hex(RULE)).font('Helvetica').fontSize(6.5)
         .text(`Audience: ${v.audience}`, M, y);

      y += 16;
      if (i < voices.length - 1) {
        doc.rect(M, y, W - M * 2, 0.5).fill(hex('#e8e5de'));
        y += 10;
      }
    });

    y += 16;

    // ── THEMES ──
    if (y > H - 200) { doc.addPage(); y = M; }

    // Positive themes
    const colW = (W - M * 2 - 16) / 2;

    doc.fillColor(hex(BLUE)).font('Helvetica-Bold').fontSize(6.5)
       .text('KEY THEMES', M, y, { characterSpacing: 2 });
    doc.rect(M, y + 14, W - M * 2, 0.5).fill(hex(RULE));
    y += 22;

    // Positive column header
    doc.fillColor(hex(POS)).font('Helvetica-Bold').fontSize(7)
       .text('POSITIVE DRIVERS', M, y, { characterSpacing: 1.5 });
    doc.fillColor(hex(NEG)).font('Helvetica-Bold').fontSize(7)
       .text('NEGATIVE DRIVERS', M + colW + 16, y, { characterSpacing: 1.5 });
    y += 14;

    const posT = result.positive_themes || [];
    const negT = result.negative_themes || [];
    const maxT = Math.max(posT.length, negT.length);

    for (let i = 0; i < maxT; i++) {
      if (y > H - 120) { doc.addPage(); y = M; }

      if (posT[i]) {
        doc.fillColor(hex(BLACK)).font('Helvetica').fontSize(8.5)
           .text(`+  ${posT[i]}`, M, y, { width: colW });
      }
      if (negT[i]) {
        doc.fillColor(hex(BLACK)).font('Helvetica').fontSize(8.5)
           .text(`-  ${negT[i]}`, M + colW + 16, y, { width: colW });
      }
      y += 18;
    }

    y += 16;

    // ── SUMMARY NOTE ──
    if (y > H - 120) { doc.addPage(); y = M; }

    doc.rect(M, y, W - M * 2, 0.5).fill(hex(RULE));
    y += 16;

    doc.fillColor(hex(MID)).font('Helvetica-Oblique').fontSize(10).lineGap(3)
       .text(`"${result.summary_note}"`, M, y, { width: W - M * 2 });

    y += doc.heightOfString(`"${result.summary_note}"`, { width: W - M * 2, fontSize: 10 }) + 24;

    // ── CONTACT DETAILS ──
    if (y > H - 130) { doc.addPage(); y = M; }

    doc.rect(M, y, W - M * 2, 0.5).fill(hex(RULE));
    y += 16;

    doc.fillColor(hex(BLUE)).font('Helvetica-Bold').fontSize(6.5)
       .text('REQUESTED BY', M, y, { characterSpacing: 2 });
    y += 14;

    doc.fillColor(hex(BLACK)).font('Helvetica-Bold').fontSize(9)
       .text(contact.name, M, y);
    y += 13;

    doc.fillColor(hex(MID)).font('Helvetica').fontSize(8.5)
       .text(`${contact.title}, ${contact.company}`, M, y);
    y += 12;

    doc.fillColor(hex(MID)).font('Helvetica').fontSize(8.5)
       .text(contact.email, M, y);

    // ── FOOTER BAND ──
    const footY = H - 60;
    doc.rect(0, footY, W, 60).fill(hex(NAVY));

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
       .text('GRAYLING', M, footY + 14, { characterSpacing: 3 });

    doc.fillColor(hex(BLUE)).font('Helvetica').fontSize(7.5).lineGap(2)
       .text(
         'Public perception moves fast. Grayling helps you stay ahead of it, shape it, and turn it into advantage.',
         M, footY + 28,
         { width: W - M * 2 - 80 }
       );

    doc.fillColor(hex(RULE)).font('Helvetica').fontSize(6.5)
       .text('www.grayling.com', W - M - 80, footY + 36);

    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendKey = process.env.RESEND_API_KEY || 're_X4j4wzMK_NoFSY7CzADJv1DpAwzh1chRd';

  const { contact, result } = req.body;

  if (!contact?.name || !contact?.email || !result) {
    return res.status(400).json({ error: 'Missing contact details or report data' });
  }

  try {
    // Generate PDF
    const pdfBuffer = await buildPDF(contact, result);
    const pdfBase64 = pdfBuffer.toString('base64');

    const resend = new Resend(resendKey);
    const entitySlug = (result.entity || 'entity').replace(/\s+/g, '-').toLowerCase();
    const filename = `grayling-sentiment-${entitySlug}.pdf`;

    await resend.emails.send({
      from: 'Grayling Sentiment Analyser <onboarding@resend.dev>',
      to: 'srividhyanatarajan11@gmail.com',
      subject: `Sentiment Report Request: ${result.entity} — ${contact.name}, ${contact.company}`,
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
                  <span style="font-size:16px;font-weight:bold;color:${result.overall_sentiment==='positive'?'#1a5c3a':result.overall_sentiment==='negative'?'#7a1a1a':'#1a3a5c'}">${result.overall_sentiment.toUpperCase()}</span>
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
      attachments: [
        {
          filename,
          content: pdfBase64,
          type: 'application/pdf'
        }
      ]
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Contact handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
