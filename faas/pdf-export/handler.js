const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Execution counter (simulates FaaS cold start tracking)
let executionCount = 0;
const startTime = Date.now();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'pdf-export-function',
    executions: executionCount,
    uptime: Math.floor((Date.now() - startTime) / 1000) + 's'
  });
});

// Main FaaS function endpoint
app.post('/function/pdf-export', async (req, res) => {
  const functionStartTime = Date.now();
  executionCount++;

  console.log(`[Execution #${executionCount}] PDF Export function triggered`);

  try {
    const { title, content, metadata } = req.body;

    // Validate input
    if (!title || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title and content' 
      });
    }

    console.log(`Generating PDF for document: "${title}"`);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(24)
       .fillColor('#333333')
       .text(title, { align: 'center' })
       .moveDown(0.5);

    // Add metadata if provided
    if (metadata) {
      doc.fontSize(10)
         .fillColor('#666666');
      
      if (metadata.author) {
        doc.text(`Author: ${metadata.author}`);
      }
      if (metadata.createdAt) {
        doc.text(`Created: ${new Date(metadata.createdAt).toLocaleDateString()}`);
      }
      if (metadata.version) {
        doc.text(`Version: ${metadata.version}`);
      }
      
      doc.moveDown(1);
    }

    // Add horizontal line
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .stroke('#cccccc')
       .moveDown(1);

    // Add content
    doc.fontSize(12)
       .fillColor('#000000')
       .text(content, {
         align: 'left',
         lineGap: 4
       });

    // Add footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor('#999999')
         .text(
           `Page ${i + 1} of ${pageCount}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
    }

    // Finalize PDF
    doc.end();

    const executionTime = Date.now() - functionStartTime;
    console.log(`[Execution #${executionCount}] PDF generated successfully in ${executionTime}ms`);

  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // If headers already sent, can't send JSON error
    if (res.headersSent) {
      return res.end();
    }
    
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message 
    });
  }
});

// Metrics endpoint (simulates FaaS monitoring)
app.get('/metrics', (req, res) => {
  res.json({
    service: 'pdf-export-function',
    totalExecutions: executionCount,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    uptimeFormatted: formatUptime((Date.now() - startTime) / 1000),
    averageExecutionsPerMinute: executionCount / ((Date.now() - startTime) / 60000) || 0
  });
});

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Function not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF Export Function (FaaS) running on port ${PORT}`);
  console.log(`Ready to handle requests at POST /function/pdf-export`);
});