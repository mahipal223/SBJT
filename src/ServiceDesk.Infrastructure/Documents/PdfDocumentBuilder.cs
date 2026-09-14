using System.Globalization;
using System.Text;
using ServiceDesk.Application.Financials;

namespace ServiceDesk.Infrastructure.Documents;

public static class PdfDocumentBuilder
{
    public static byte[] BuildEstimatePdf(EstimateRecord estimate, string businessName, string? businessEmail = null)
    {
        var builder = new SimplePdfWriter();

        // Header / Brand
        builder.DrawHeader(businessName, "ESTIMATE", $"#{estimate.EstimateNumber} (Rev {estimate.Revision})");
        builder.DrawRule();

        // Meta info columns
        builder.DrawText(50, builder.CurrentY, "CUSTOMER", isBold: true, size: 9, color: (0.4f, 0.4f, 0.4f));
        builder.DrawText(350, builder.CurrentY, "ESTIMATE DETAILS", isBold: true, size: 9, color: (0.4f, 0.4f, 0.4f));
        builder.MoveDown(14);

        builder.DrawText(50, builder.CurrentY, estimate.CustomerName, isBold: true, size: 11);
        builder.DrawText(350, builder.CurrentY, $"Status: {estimate.Status}", size: 10);
        builder.MoveDown(14);

        if (!string.IsNullOrWhiteSpace(businessEmail))
        {
            builder.DrawText(50, builder.CurrentY, $"Provider: {businessEmail}", size: 9, color: (0.3f, 0.3f, 0.3f));
        }
        builder.DrawText(350, builder.CurrentY, $"Created: {estimate.CreatedAt.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture)}", size: 9, color: (0.3f, 0.3f, 0.3f));
        builder.MoveDown(12);

        builder.DrawText(350, builder.CurrentY, $"Valid Until: {estimate.ValidUntil.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture)}", size: 9, color: (0.3f, 0.3f, 0.3f));
        builder.MoveDown(24);

        // Table Header
        builder.DrawTableHeader("DESCRIPTION", "TYPE", "QTY", "UNIT PRICE", "TOTAL");
        builder.MoveDown(18);

        // Line Items
        foreach (var item in estimate.Items)
        {
            builder.DrawTableRow(
                item.Description,
                item.ItemType,
                $"{item.Quantity:0.##} {item.Unit}",
                item.UnitPrice.ToString("C", CultureInfo.CurrentCulture),
                item.LineTotal.ToString("C", CultureInfo.CurrentCulture));
            builder.MoveDown(16);
        }

        builder.DrawRule();
        builder.MoveDown(12);

        // Totals Box
        builder.DrawTotalLine("Subtotal:", estimate.Subtotal.ToString("C", CultureInfo.CurrentCulture));
        if (estimate.DiscountTotal > 0)
        {
            builder.DrawTotalLine("Discount:", $"-{estimate.DiscountTotal.ToString("C", CultureInfo.CurrentCulture)}");
        }
        if (estimate.TaxTotal > 0)
        {
            builder.DrawTotalLine("Tax:", estimate.TaxTotal.ToString("C", CultureInfo.CurrentCulture));
        }
        builder.DrawTotalLine("Total:", estimate.Total.ToString("C", CultureInfo.CurrentCulture), isGrandTotal: true);

        // Footer note
        builder.MoveDown(30);
        builder.DrawText(50, builder.CurrentY, "Thank you for considering our services. For questions, please reach out to our team.", size: 8, color: (0.45f, 0.45f, 0.45f));

        return builder.ToByteArray();
    }

    public static byte[] BuildInvoicePdf(InvoiceRecord invoice, string businessName, string? businessEmail = null)
    {
        var builder = new SimplePdfWriter();

        // Header / Brand
        builder.DrawHeader(businessName, "INVOICE", $"#{invoice.InvoiceNumber}");
        builder.DrawRule();

        // Meta info columns
        builder.DrawText(50, builder.CurrentY, "BILLED TO", isBold: true, size: 9, color: (0.4f, 0.4f, 0.4f));
        builder.DrawText(350, builder.CurrentY, "INVOICE DETAILS", isBold: true, size: 9, color: (0.4f, 0.4f, 0.4f));
        builder.MoveDown(14);

        builder.DrawText(50, builder.CurrentY, invoice.CustomerName, isBold: true, size: 11);
        builder.DrawText(350, builder.CurrentY, $"Status: {(invoice.PaymentStatus == "Paid" ? "Paid" : invoice.Status)}", size: 10);
        builder.MoveDown(14);

        if (!string.IsNullOrWhiteSpace(businessEmail))
        {
            builder.DrawText(50, builder.CurrentY, $"Issued by: {businessEmail}", size: 9, color: (0.3f, 0.3f, 0.3f));
        }
        builder.DrawText(350, builder.CurrentY, $"Issued: {(invoice.IssuedOn.HasValue ? invoice.IssuedOn.Value.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture) : "Draft")}", size: 9, color: (0.3f, 0.3f, 0.3f));
        builder.MoveDown(12);

        if (invoice.DueOn.HasValue)
        {
            builder.DrawText(350, builder.CurrentY, $"Due Date: {invoice.DueOn.Value.ToString("MMM dd, yyyy", CultureInfo.InvariantCulture)}", size: 9, color: (0.3f, 0.3f, 0.3f));
            builder.MoveDown(12);
        }

        builder.MoveDown(14);

        // Table Header
        builder.DrawTableHeader("DESCRIPTION", "TYPE", "QTY", "UNIT PRICE", "TOTAL");
        builder.MoveDown(18);

        // Line Items
        foreach (var item in invoice.Items)
        {
            builder.DrawTableRow(
                item.Description,
                item.ItemType,
                $"{item.Quantity:0.##} {item.Unit}",
                item.UnitPrice.ToString("C", CultureInfo.CurrentCulture),
                item.LineTotal.ToString("C", CultureInfo.CurrentCulture));
            builder.MoveDown(16);
        }

        builder.DrawRule();
        builder.MoveDown(12);

        // Totals Box
        builder.DrawTotalLine("Subtotal:", invoice.Subtotal.ToString("C", CultureInfo.CurrentCulture));
        if (invoice.DiscountTotal > 0)
        {
            builder.DrawTotalLine("Discount:", $"-{invoice.DiscountTotal.ToString("C", CultureInfo.CurrentCulture)}");
        }
        if (invoice.TaxTotal > 0)
        {
            builder.DrawTotalLine("Tax:", invoice.TaxTotal.ToString("C", CultureInfo.CurrentCulture));
        }
        builder.DrawTotalLine("Total:", invoice.Total.ToString("C", CultureInfo.CurrentCulture), isGrandTotal: true);
        builder.DrawTotalLine("Balance Due:", invoice.Balance.ToString("C", CultureInfo.CurrentCulture), isGrandTotal: true, isAccent: invoice.Balance > 0);

        // Footer note
        builder.MoveDown(30);
        builder.DrawText(50, builder.CurrentY, "Payment is appreciated upon receipt. Thank you for your business!", size: 8, color: (0.45f, 0.45f, 0.45f));

        return builder.ToByteArray();
    }

    private sealed class SimplePdfWriter
    {
        private readonly StringBuilder _content = new();
        public float CurrentY { get; private set; } = 750f;

        public void MoveDown(float amount) => CurrentY -= amount;

        public void DrawHeader(string businessName, string docTitle, string docNumber)
        {
            // Business title
            DrawText(50, CurrentY, businessName, isBold: true, size: 18, color: (0.05f, 0.35f, 0.38f));

            // Document type badge / text on top right
            DrawText(420, CurrentY, docTitle, isBold: true, size: 16, color: (0.15f, 0.15f, 0.15f));
            MoveDown(18);

            DrawText(420, CurrentY, docNumber, isBold: true, size: 11, color: (0.4f, 0.4f, 0.4f));
            MoveDown(20);
        }

        public void DrawRule()
        {
            // Draw horizontal rule line
            _content.Append(CultureInfo.InvariantCulture, $"0.85 0.88 0.90 RG 1 w 50 {CurrentY:0.##} m 545 {CurrentY:0.##} l S\n");
            MoveDown(14);
        }

        public void DrawTableHeader(string col1, string col2, string col3, string col4, string col5)
        {
            // Background bar
            _content.Append(CultureInfo.InvariantCulture, $"0.95 0.97 0.98 rg 50 {CurrentY - 5:0.##} 495 18 re f\n");

            DrawText(55, CurrentY, col1, isBold: true, size: 8, color: (0.3f, 0.3f, 0.3f));
            DrawText(270, CurrentY, col2, isBold: true, size: 8, color: (0.3f, 0.3f, 0.3f));
            DrawText(340, CurrentY, col3, isBold: true, size: 8, color: (0.3f, 0.3f, 0.3f));
            DrawText(410, CurrentY, col4, isBold: true, size: 8, color: (0.3f, 0.3f, 0.3f));
            DrawText(480, CurrentY, col5, isBold: true, size: 8, color: (0.3f, 0.3f, 0.3f));
        }

        public void DrawTableRow(string col1, string col2, string col3, string col4, string col5)
        {
            // Shorten description if too long
            var desc = col1.Length > 36 ? col1[..33] + "..." : col1;
            DrawText(55, CurrentY, desc, size: 9, color: (0.1f, 0.1f, 0.1f));
            DrawText(270, CurrentY, col2, size: 8, color: (0.4f, 0.4f, 0.4f));
            DrawText(340, CurrentY, col3, size: 9, color: (0.2f, 0.2f, 0.2f));
            DrawText(410, CurrentY, col4, size: 9, color: (0.2f, 0.2f, 0.2f));
            DrawText(480, CurrentY, col5, isBold: true, size: 9, color: (0.1f, 0.1f, 0.1f));
        }

        public void DrawTotalLine(string label, string amount, bool isGrandTotal = false, bool isAccent = false)
        {
            var size = isGrandTotal ? 11f : 9f;
            var isBold = isGrandTotal;
            var color = isAccent
                ? (0.8f, 0.15f, 0.15f)
                : (0.15f, 0.15f, 0.15f);

            DrawText(370, CurrentY, label, isBold: isBold, size: size, color: color);
            DrawText(480, CurrentY, amount, isBold: isBold, size: size, color: color);
            MoveDown(isGrandTotal ? 18 : 14);
        }

        public void DrawText(float x, float y, string text, bool isBold = false, float size = 10f, (float r, float g, float b)? color = null)
        {
            var font = isBold ? "/F2" : "/F1";
            var (r, g, b) = color ?? (0.1f, 0.1f, 0.1f);
            var safeText = EscapePdf(text);

            _content.Append(CultureInfo.InvariantCulture, $"{r:0.##} {g:0.##} {b:0.##} rg BT {font} {size:0.##} Tf {x:0.##} {y:0.##} Td ({safeText}) Tj ET\n");
        }

        private static string EscapePdf(string input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            return input
                .Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("(", "\\(", StringComparison.Ordinal)
                .Replace(")", "\\)", StringComparison.Ordinal);
        }

        public byte[] ToByteArray()
        {
            var streamBytes = Encoding.ASCII.GetBytes(_content.ToString());

            // Build PDF objects
            var objects = new List<string>();

            // 1: Catalog
            objects.Add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

            // 2: Pages
            objects.Add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

            // 3: Page
            objects.Add("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n");

            // 4: Content Stream
            var streamHeader = $"4 0 obj\n<< /Length {streamBytes.Length} >>\nstream\n";
            const string streamFooter = "\nendstream\nendobj\n";

            // 5: Font F1 (Helvetica)
            objects.Add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

            // 6: Font F2 (Helvetica-Bold)
            objects.Add("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

            using var memory = new MemoryStream();
            using var writer = new StreamWriter(memory, Encoding.ASCII, leaveOpen: true);

            writer.Write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
            writer.Flush();

            var offsets = new List<long> { 0 };

            // Object 1
            offsets.Add(memory.Position);
            writer.Write(objects[0]);
            writer.Flush();

            // Object 2
            offsets.Add(memory.Position);
            writer.Write(objects[1]);
            writer.Flush();

            // Object 3
            offsets.Add(memory.Position);
            writer.Write(objects[2]);
            writer.Flush();

            // Object 4 (Content stream)
            offsets.Add(memory.Position);
            writer.Write(streamHeader);
            writer.Flush();
            memory.Write(streamBytes, 0, streamBytes.Length);
            writer.Write(streamFooter);
            writer.Flush();

            // Object 5
            offsets.Add(memory.Position);
            writer.Write(objects[3]);
            writer.Flush();

            // Object 6
            offsets.Add(memory.Position);
            writer.Write(objects[4]);
            writer.Flush();

            // Xref table
            var xrefOffset = memory.Position;
            writer.Write($"xref\n0 {offsets.Count}\n");
            writer.Write("0000000000 65535 f \n");
            for (var i = 1; i < offsets.Count; i++)
            {
                writer.Write($"{offsets[i]:D10} 00000 n \n");
            }

            // Trailer
            writer.Write($"trailer\n<< /Size {offsets.Count} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");
            writer.Flush();

            return memory.ToArray();
        }
    }
}
