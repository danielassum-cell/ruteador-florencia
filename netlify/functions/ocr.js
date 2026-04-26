const https = require('https');
const { URL } = require('url');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    const apiKey = process.env.OCR_API_KEY;

    // Construir el body multipart manualmente
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fields = {
      apikey: apiKey,
      language: 'spa',
      OCREngine: '2',
      scale: 'true',
      base64Image: `data:application/pdf;base64,${pdfBase64}`,
    };

    let body = '';
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;

    const bodyBuffer = Buffer.from(body, 'utf8');

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.ocr.space',
        path: '/parse/image',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(bodyBuffer);
      req.end();
    });

    const data = JSON.parse(result);

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || 'Error OCR');
    }

    const texto = data.ParsedResults?.map(r => r.ParsedText).join('\n') || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
