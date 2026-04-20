const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const webp = require('../src/webpconverter.js');
const fs = require('fs');
const os = require('os');

const app = express();
const upload = multer({ dest: os.tmpdir() });

app.use(cors());
app.use(express.static('src'));

webp.grant_permission();

const sharp = require('sharp');

app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const converterType = req.body.converterType || 'towebp';
    const format = req.body.format || 'webp';
    const quality = parseInt(req.body.quality) || 80;
    const targetSize = parseInt(req.body.targetSize) || 500;
    
    let outputPath;
    let outputBuffer;
    let contentType;
    
    if (converterType === 'towebp') {
      outputPath = inputPath.replace(/\.[^/.]+$/, '.webp');
      await webp.cwebp(inputPath, outputPath, `-q ${quality}`);
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = 'image/webp';
    } 
    else if (converterType === 'fromwebp') {
      outputPath = inputPath.replace(/\.[^/.]+$/, `.${format}`);
      await webp.dwebp(inputPath, outputPath, '-o');
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    } 
    else if (converterType === 'compress') {
      outputPath = inputPath.replace(/\.[^/.]+$/, `.${format}`);
      if (format === 'jpeg') {
        await sharp(inputPath)
          .jpeg({ quality: Math.min(quality, 80), progressive: true })
          .toFile(outputPath);
      } else {
        await sharp(inputPath)
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(outputPath);
      }
      outputBuffer = fs.readFileSync(outputPath);
      fs.unlinkSync(outputPath);
      contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    } 
    else if (converterType === 'pdf') {
      outputPath = inputPath.replace(/\.[^/.]+$/, '.pdf');
      const inputBuffer = fs.readFileSync(inputPath);
      const pdfBuffer = await createPdf(inputBuffer);
      fs.writeFileSync(outputPath, pdfBuffer);
      outputBuffer = pdfBuffer;
      fs.unlinkSync(outputPath);
      contentType = 'application/pdf';
    }
    
    fs.unlinkSync(inputPath);
    
    res.set('Content-Type', contentType);
    res.send(outputBuffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function createPdf(imageBuffer) {
  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
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

module.exports = app;