const { PDFParse } = require('pdf-parse');
async function test() {
  const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 712 Td (Hemoglobin: 14.2 g/dL) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n310\n%%EOF');
  
  const parser = new PDFParse({ data: dummyPdf });
  await parser.load();
  const textResult = await parser.getText();
  const text = typeof textResult === 'string' ? textResult : (textResult?.text || '');
  await parser.destroy();
  console.log('Extracted text:', text.trim());
}
test().catch(console.error);
