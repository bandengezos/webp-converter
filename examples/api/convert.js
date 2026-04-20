const webp = require('../src/webpconverter.js');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');

webp.grant_permission();

async function createPdf(imageBuffer) {
  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  
  let img;
  try {
    img = await pdfDoc.embedJpg(imageBuffer);
  } catch {
    img = await pdfDoc.embedPng(imageBuffer);
  }
  
  const dims = img.scaleToFit(width - 40, height - 40);
  page.drawImage(img, {
    x: (width - dims.width) / 2,
    y: (height - dims.height) / 2,
    width: dims.width,
    height: dims.height,
  });
  
  return pdfDoc.save();
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  try {
    const { converterType, format, quality } = req.query;
    const convType = converterType || 'towebp';
    const outFormat = format || 'webp';
    const q = parseInt(quality) || 80;
    
    const buffer = req.body;
    const tmpDir = os.tmpdir();
    const inputPath = `${tmpDir}/input_${Date.now()}`;
    const outputPath = inputPath.replace(/\.[^/.]+$/, `.${outFormat}`);
    
    fs.writeFileSync(inputPath, buffer);
    
    let outputBuffer;
    let contentType;
    
    if (convType === 'towebp') {
      await webp.cwebp(inputPath, outputPath, `-q ${q}`);
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = 'image/webp';
    } 
    else if (convType === 'fromwebp') {
      await webp.dwebp(inputPath, outputPath, '-o');
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = outFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    } 
    else if (convType === 'compress') {
      if (outFormat === 'jpeg') {
        await sharp(inputPath).jpeg({ quality: Math.min(q, 80), progressive: true }).toFile(outputPath);
      } else {
        await sharp(inputPath).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outputPath);
      }
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = outFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    } 
    else if (convType === 'pdf') {
      const pdfBuffer = await createPdf(buffer);
      outputBuffer = pdfBuffer;
      contentType = 'application/pdf';
    }
    
    fs.unlinkSync(inputPath);
    
    res.set('Content-Type', contentType);
    res.send(outputBuffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  }
}