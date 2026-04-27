const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = process.env.VISION_API_KEY;

    if (!apiKey) throw new Error('VISION_API_KEY no configurada');

    const b64 = body.imageBase64;
    if (!b64) throw new Error('No se recibió imagen');

    // Llamada a Google Cloud Vision API
    const requestBody = JSON.stringify({
      requests: [{
        image: { content: b64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['es'] }
      }]
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'vision.googleapis.com',
        path: `/v1/images:annotate?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
      req.write(requestBody);
      req.end();
    });

    const data = JSON.parse(result);

    if (data.error) throw new Error(data.error.message);

    const annotation = data.responses?.[0];
    if (!annotation || annotation.error) {
      throw new Error(annotation?.error?.message || 'Sin texto detectado');
    }

    const texto = annotation.fullTextAnnotation?.text || 
                  annotation.textAnnotations?.[0]?.description || '';

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      body: JSON.stringify({ texto }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

