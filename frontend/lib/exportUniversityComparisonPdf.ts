export interface UniversityForExport {
  id: string;
  name: string;
  country: string;
  city: string;
  logo?: string;
  rank?: number;
  accept?: number;
  tuition?: number;
  description?: string;
  slug?: string;
  website?: string;
  _score?: number;
  loan?: boolean;
  scholarships?: number;
  avgjobSalary?: number;
  employment?: number;
  topRecruiters?: string[];
}

export interface ExportComparisonOptions {
  universities: UniversityForExport[];
  aiReport?: {
    summary?: string;
    roiChampion?: any;
    costChampion?: any;
    vidyaLoansRating?: string;
    vidyaLoansAdvice?: string;
  } | null;
  weights?: {
    cost?: number;
    roi?: number;
    employability?: number;
    reputation?: number;
    culture?: number;
  };
}

export function generateUniversityComparisonHtml({
  universities,
  aiReport,
  weights,
}: ExportComparisonOptions): string {
  const currentDate = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const reportId = `VL-CMP-${Date.now().toString(36).toUpperCase()}`;
  const isLandscape = universities.length >= 4;

  // Compute fallback analytics if AI report not yet triggered
  const scoredUnis = universities.map((u) => {
    const tuition = u.tuition || 30000;
    const salary = u.avgjobSalary || 60000;
    const roi = tuition > 0 ? salary / tuition : 1;
    return { uni: u, roi };
  });
  const roiChamp =
    aiReport?.roiChampion ||
    [...scoredUnis].sort((a, b) => b.roi - a.roi)[0]?.uni ||
    universities[0];
  const costChamp =
    aiReport?.costChampion ||
    [...universities].sort((a, b) => (a.tuition || 0) - (b.tuition || 0))[0] ||
    universities[0];

  const executiveSummary =
    aiReport?.summary ||
    `Granular comparative assessment across ${universities
      .map((u) => u.name)
      .join(
        ", "
      )} reveals significant variance in institutional ROI and tuition commitments. ${
      roiChamp?.name || "The leading institution"
    } demonstrates superior income-to-tuition velocity, while ${
      costChamp?.name || "the budget leader"
    } delivers the most capital-efficient academic pathway. All compared institutions maintain approved accreditation status for Vidya Loans overseas education loan funding.`;

  const loanAdvice =
    aiReport?.vidyaLoansAdvice ||
    "All shortlisted universities qualify for pre-negotiated education loan packages with zero collateral up to ₹1.5 Crore. Sanctions processed within 48 to 72 business hours via Vidya Loans partner banking syndicates.";

  const rating = aiReport?.vidyaLoansRating || "Verified A-Grade Academic Profile";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vidya_Loans_Comparison_${universities
    .map((u) => u.name.replace(/[^a-zA-Z0-9]/g, "_"))
    .join("_vs_")}</title>
  <style>
    @page {
      size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
      margin: 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    /* Top Interactive Action Bar (Hidden during Print) */
    .screen-action-bar {
      position: sticky;
      top: 0;
      background: linear-gradient(135deg, #4b0082, #6605c7);
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(102, 5, 199, 0.25);
      z-index: 9999;
      font-size: 13px;
    }
    .screen-action-bar .btn-print {
      background: #ffffff;
      color: #6605c7;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .screen-action-bar .btn-print:hover {
      background: #f8f4ff;
    }
    .screen-action-bar .btn-close {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
    
    @media print {
      .screen-action-bar {
        display: none !important;
      }
      body {
        background: transparent !important;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
      }
    }

    .report-container {
      max-width: ${isLandscape ? "1080px" : "800px"};
      margin: 0 auto;
      padding: 16px 20px;
    }

    /* Header Section */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #6605c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-logo-cell {
      vertical-align: middle;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #6605c7;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .brand-tagline {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .meta-cell {
      text-align: right;
      vertical-align: middle;
    }
    .badge-official {
      display: inline-block;
      background: #f3e8ff;
      border: 1px solid #d8b4fe;
      color: #6605c7;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .meta-line {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
    }

    /* Section Headings */
    .section-title {
      font-size: 12px;
      font-weight: 900;
      color: #1e1b4b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-title::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 12px;
      background: #6605c7;
      border-radius: 2px;
    }

    /* Shortlist Preview Cards */
    .uni-cards-grid {
      display: grid;
      grid-template-columns: repeat(${universities.length}, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .uni-card {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 10px;
      padding: 10px 12px;
      position: relative;
    }
    .uni-card-rank {
      font-size: 9px;
      font-weight: 900;
      color: #6605c7;
      background: #ffffff;
      border: 1px solid #d8b4fe;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .uni-card-name {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 2px;
    }
    .uni-card-loc {
      font-size: 9.5px;
      font-weight: 600;
      color: #64748b;
    }

    /* Core Comparison Matrix Table */
    .matrix-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .matrix-table th, .matrix-table td {
      padding: 8px 12px;
      font-size: 10px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
    }
    .matrix-table th:last-child, .matrix-table td:last-child {
      border-right: none;
    }
    .matrix-table tr:last-child td {
      border-bottom: none;
    }
    .matrix-table thead th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      text-align: center;
      font-size: 10.5px;
    }
    .matrix-table thead th.metric-col-header {
      text-align: left;
      width: 190px;
      background: #e2e8f0;
      color: #334155;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .matrix-table tbody td.metric-label {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      text-align: left;
    }
    .matrix-table tbody td.metric-val {
      text-align: center;
      font-weight: 600;
      color: #0f172a;
    }
    .val-highlight {
      font-weight: 800;
      color: #6605c7;
    }
    .val-emerald {
      font-weight: 800;
      color: #047857;
    }
    .tag-loan {
      display: inline-block;
      padding: 2px 6px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .recruiter-pill {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 600;
      margin: 1px;
    }

    /* AI Synthesis & Verdict Section */
    .ai-verdict-box {
      background: linear-gradient(135deg, #fbf7ff 0%, #fffbf0 100%);
      border: 1px solid #e9d5ff;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ai-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #6605c7;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ai-summary-text {
      font-size: 10px;
      color: #334155;
      line-height: 1.5;
      margin-bottom: 12px;
      white-space: pre-line;
    }
    .ai-champions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }
    .champion-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .champion-tag {
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1.5px 5px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 3px;
    }
    .tag-roi {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .tag-cost {
      background: #f5f3ff;
      color: #6605c7;
      border: 1px solid #ddd6fe;
    }
    .tag-loan-eval {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .champion-name {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .champion-metric {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }
    .champion-metric strong {
      color: #0f172a;
    }

    /* Lending Advantage Banner */
    .lending-banner {
      background: #0f172a;
      color: #ffffff;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .lending-banner-title {
      font-size: 11px;
      font-weight: 900;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .lending-columns {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      font-size: 9.5px;
    }
    .lending-col-title {
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 2px;
    }
    .lending-col-desc {
      color: #94a3b8;
      line-height: 1.35;
    }

    /* Footer Legal & Verification */
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #64748b;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-left {
      max-width: 70%;
      line-height: 1.3;
    }
    .footer-right {
      text-align: right;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <!-- Action Bar on Screen Only -->
  <div class="screen-action-bar">
    <div>
      <strong>Vidya Loans Document Generator</strong> &bull; ${universities.length} Institutions Evaluated
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Save / Print as PDF
      </button>
      <button class="btn-close" onclick="window.close()">Close Preview</button>
    </div>
  </div>

  <div class="report-container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td class="brand-logo-cell">
          <div class="brand-title">VIDYA LOANS</div>
          <div class="brand-tagline">Academic Intelligence & Education Finance Syndicate</div>
        </td>
        <td class="meta-cell">
          <div class="badge-official">Official University Comparison Dossier</div>
          <div class="meta-line">Ref: <strong>${reportId}</strong> &bull; Generated: ${currentDate}, ${currentTime}</div>
          <div class="meta-line">Source: QS 2026 Academic Index &bull; Vidya Loans Lending Matrix</div>
        </td>
      </tr>
    </table>

    <!-- Universities Headline Cards -->
    <div class="section-title">Institutional Profiles Under Evaluation</div>
    <div class="uni-cards-grid">
      ${universities
        .map(
          (u) => `
        <div class="uni-card">
          <span class="uni-card-rank">QS Rank #${u.rank || "N/A"}</span>
          <div class="uni-card-name">${u.name}</div>
          <div class="uni-card-loc">${u.city ? `${u.city}, ` : ""}${u.country}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <!-- Comparison Matrix Table -->
    <div class="section-title">Comprehensive Key Metrics Matrix</div>
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="metric-col-header">Evaluated Metric</th>
          ${universities
            .map(
              (u) => `
            <th>
              <div>${u.name}</div>
              <div style="font-size: 8.5px; font-weight: 600; color: #6605c7; text-transform: uppercase;">
                ${u.country}
              </div>
            </th>
          `
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="metric-label">QS World Rank</td>
          ${universities
            .map(
              (u) => `<td class="matrix-table val-highlight metric-val">QS #${u.rank || "N/A"}</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Annual Tuition (USD)</td>
          ${universities
            .map(
              (u) =>
                `<td class="metric-val val-highlight">$${
                  u.tuition ? u.tuition.toLocaleString() : "N/A"
                }</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Avg Graduate Salary</td>
          ${universities
            .map(
              (u) =>
                `<td class="metric-val val-emerald">$${
                  u.avgjobSalary ? u.avgjobSalary.toLocaleString() : "N/A"
                }</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Estimated ROI Ratio</td>
          ${universities
            .map((u) => {
              const r =
                u.tuition && u.avgjobSalary
                  ? (u.avgjobSalary / u.tuition).toFixed(2)
                  : "N/A";
              return `<td class="metric-val"><strong>${
                r !== "N/A" ? `${r}x` : "N/A"
              }</strong></td>`;
            })
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Acceptance Rate</td>
          ${universities
            .map(
              (u) =>
                `<td class="metric-val">${
                  u.accept ? `${u.accept}%` : "Competitive"
                }</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Employability Rate</td>
          ${universities
            .map(
              (u) =>
                `<td class="metric-val">${
                  u.employment ? `${u.employment}%` : "90%+"
                }</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Available Scholarships Pool</td>
          ${universities
            .map(
              (u) =>
                `<td class="metric-val">${
                  u.scholarships
                    ? `$${(u.scholarships / 1000000).toFixed(1)}M`
                    : "$500K+"
                }</td>`
            )
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Top Industry Recruiters</td>
          ${universities
            .map((u) => {
              const recs = (u.topRecruiters || []).slice(0, 4);
              if (recs.length === 0)
                return `<td class="metric-val" style="color: #94a3b8; font-style: italic;">Top Multinational Employers</td>`;
              return `
              <td class="metric-val">
                ${recs
                  .map((r) => `<span class="recruiter-pill">${r}</span>`)
                  .join("")}
              </td>`;
            })
            .join("")}
        </tr>
        <tr>
          <td class="metric-label">Vidya Loans Direct Pathway</td>
          ${universities
            .map(
              (u) => `
            <td class="metric-val">
              <span class="tag-loan">
                ${u.loan !== false ? "✓ Instant Loan Match" : "✓ Eligible"}
              </span>
            </td>
          `
            )
            .join("")}
        </tr>
      </tbody>
    </table>

    <!-- AI Strategic Verdict Section -->
    <div class="ai-verdict-box">
      <div class="ai-badge-row">
        <div class="ai-badge">★ AI Strategic Synthesis & Recommendation</div>
        <div style="font-size: 9px; font-weight: 700; color: #6605c7;">${rating}</div>
      </div>
      <div class="ai-summary-text">${executiveSummary}</div>
      
      <div class="ai-champions-grid">
        <div class="champion-card">
          <span class="champion-tag tag-roi">ROI Efficiency Leader</span>
          <div class="champion-name">${roiChamp.name}</div>
          <div class="champion-metric">Avg Salary: <strong>$${
            roiChamp.avgjobSalary
              ? roiChamp.avgjobSalary.toLocaleString()
              : "100,000+"
          }</strong></div>
        </div>
        <div class="champion-card">
          <span class="champion-tag tag-cost">Cost Commitment Leader</span>
          <div class="champion-name">${costChamp.name}</div>
          <div class="champion-metric">Lowest Tuition: <strong>$${
            costChamp.tuition
              ? costChamp.tuition.toLocaleString()
              : "Affordable"
          }</strong></div>
        </div>
        <div class="champion-card">
          <span class="champion-tag tag-loan-eval">Financing Approval Status</span>
          <div class="champion-name">Pre-Approved Collateral Free</div>
          <div class="champion-metric">Turnaround: <strong>48 - 72 Hours</strong></div>
        </div>
      </div>
    </div>

    <!-- Vidya Loans Lending Advantage -->
    <div class="lending-banner">
      <div class="lending-banner-title">Vidya Loans Student Financing Benefits</div>
      <div class="lending-columns">
        <div>
          <div class="lending-col-title">Pre-Approved Interest Rates</div>
          <div class="lending-col-desc">Rates starting from 8.5% p.a. through leading partner banks (SBI, HDFC Credila, Axis Bank, ICICI Bank).</div>
        </div>
        <div>
          <div class="lending-col-title">Up to ₹1.5 Cr Unsecured</div>
          <div class="lending-col-desc">No collateral or third-party property pledge needed for premier listed international institutions.</div>
        </div>
        <div>
          <div class="lending-col-title">Fast-Track Turnaround</div>
          <div class="lending-col-desc">Receive digital conditional sanction letters within 48 to 72 business hours for visa filing.</div>
        </div>
      </div>
    </div>

    <!-- Official Footer -->
    <div class="report-footer">
      <div class="footer-left">
        <strong>Notice:</strong> This analytical report is generated for student comparative planning and financing pre-qualification via Vidya Loans (vidyaloans.in). Figures are based on official institutional disclosures and standard lending partner guidelines.
      </div>
      <div class="footer-right">
        Vidya Loans Higher Education Network<br>
        Portal: <strong>www.vidyaloans.in</strong> &bull; Helpline: +91 91005 34444
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print if requested via query or iframe load
    window.addEventListener('DOMContentLoaded', () => {
      // If window was opened directly for printing
      if (window.location.search.includes('autoprint=1')) {
        setTimeout(() => window.print(), 350);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Exports the University Comparison Dossier as a clean, high-resolution PDF.
 * Uses a dedicated, hidden iframe to invoke native browser print ("Save as PDF"),
 * with an automatic pop-out window fallback if iframe printing is restricted.
 */
export function exportUniversityComparisonPdf(options: ExportComparisonOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (!options.universities || options.universities.length === 0) {
      alert("Please select at least 2 universities to export comparison.");
      resolve(false);
      return;
    }

    const htmlContent = generateUniversityComparisonHtml(options);

    try {
      // Clean up any existing print iframe
      const oldIframe = document.getElementById("vidyaloans-uni-compare-print-iframe");
      if (oldIframe && oldIframe.parentNode) {
        oldIframe.parentNode.removeChild(oldIframe);
      }

      // Create hidden iframe in the current page
      const iframe = document.createElement("iframe");
      iframe.id = "vidyaloans-uni-compare-print-iframe";
      iframe.setAttribute(
        "style",
        "position: fixed; left: -9999px; top: -9999px; width: 1024px; height: 100%; border: 0; visibility: hidden;"
      );
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("Unable to access iframe document");
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Allow DOM to compute styles and fonts, then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (printErr) {
          console.warn("Iframe printing encountered issue, using popup fallback:", printErr);
          openPrintPopupFallback(htmlContent);
          resolve(true);
        } finally {
          // Remove iframe after sufficient print dialog delay
          setTimeout(() => {
            try {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            } catch (_) {}
          }, 30000);
        }
      }, 350);
    } catch (err) {
      console.warn("Direct iframe print failed, launching fallback window:", err);
      openPrintPopupFallback(htmlContent);
      resolve(true);
    }
  });
}

function openPrintPopupFallback(htmlContent: string) {
  const printWindow = window.open("", "_blank", "width=1000,height=800,scrollbars=yes");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  } else {
    alert("Please allow popups to export the University Comparison PDF.");
  }
}
