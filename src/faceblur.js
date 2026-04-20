const tf = require('@tensorflow/tfjs-node');
const faceDetection = require('@tensorflow-models/face-detection');
const sharp = require('sharp');
const fs = require('fs');

let detector = null;

const initDetector = async () => {
  if (!detector) {
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig = {
      runtime: 'tfjs',
      maxFaces: 10
    };
    detector = await faceDetection.createDetector(model, detectorConfig);
  }
  return detector;
};

const detectFaces = async (imagePath) => {
  const det = await initDetector();
  
  const imageBuffer = fs.readFileSync(imagePath);
  const image = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });
  
  const { data, info } = image;
  
  const inputTensor = tf.tensor3d(data, [info.height, info.width, 3], 'int32');
  
  const faces = await det.estimateFaces(inputTensor);
  
  inputTensor.dispose();
  
  return faces.map((face, index) => ({
    id: index,
    box: {
      x: face.box.xMin,
      y: face.box.yMin,
      width: face.box.width,
      height: face.box.height
    },
    confidence: face.box.score || face.box._score || 0,
    keypoints: face.keypoints?.map(kp => ({
      x: kp.x,
      y: kp.y,
      name: kp.name
    })) || []
  }));
};

const applyBlur = async (imagePath, outputPath, faceIndices, blurAmount = 30) => {
  const imageBuffer = fs.readFileSync(imagePath);
  
  let pipeline = sharp(imageBuffer);
  const metadata = await pipeline.metadata();
  
  const faces = await detectFaces(imagePath);
  
  if (faces.length === 0) {
    throw new Error('No faces detected in the image');
  }
  
  const validIndices = faceIndices.filter(idx => idx >= 0 && idx < faces.length);
  
  if (validIndices.length === 0) {
    throw new Error('Invalid face indices provided');
  }
  
  const composites = [];
  
  for (const faceIndex of validIndices) {
    const face = faces[faceIndex];
    const { x, y, width, height } = face.box;
    
    const padding = Math.max(width, height) * 0.2;
    const blurRegionX = Math.max(0, Math.floor(x - padding));
    const blurRegionY = Math.max(0, Math.floor(y - padding));
    const blurRegionWidth = Math.min(metadata.width - blurRegionX, Math.ceil(width + padding * 2));
    const blurRegionHeight = Math.min(metadata.height - blurRegionY, Math.ceil(height + padding * 2));
    
    const blurBuffer = await sharp(imageBuffer)
      .extract({
        left: blurRegionX,
        top: blurRegionY,
        width: blurRegionWidth,
        height: blurRegionHeight
      })
      .blur(blurAmount)
      .toBuffer();
    
    composites.push({
      input: blurBuffer,
      left: blurRegionX,
      top: blurRegionY
    });
  }
  
  await pipeline
    .composite(composites)
    .toFile(outputPath);
  
  return {
    success: true,
    outputPath,
    blurredFaces: validIndices,
    totalFaces: faces.length
  };
};

const getFaceThumbnails = async (imagePath) => {
  const faces = await detectFaces(imagePath);
  const imageBuffer = fs.readFileSync(imagePath);
  const metadata = await sharp(imageBuffer).metadata();
  
  const thumbnails = [];
  
  for (const face of faces) {
    const { x, y, width, height } = face.box;
    const padding = Math.max(width, height) * 0.3;
    
    const extractX = Math.max(0, Math.floor(x - padding));
    const extractY = Math.max(0, Math.floor(y - padding));
    const extractWidth = Math.min(metadata.width - extractX, Math.ceil(width + padding * 2));
    const extractHeight = Math.min(metadata.height - extractY, Math.ceil(height + padding * 2));
    
    const thumbnailBuffer = await sharp(imageBuffer)
      .extract({
        left: extractX,
        top: extractY,
        width: extractWidth,
        height: extractHeight
      })
      .resize(100, 100)
      .jpeg()
      .toBuffer();
    
    thumbnails.push({
      id: face.id,
      base64: `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`,
      confidence: face.confidence
    });
  }
  
  return thumbnails;
};

module.exports = {
  detectFaces,
  applyBlur,
  getFaceThumbnails,
  initDetector
};
