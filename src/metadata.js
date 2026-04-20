const ExifReader = require('exifreader');

module.exports.getMetadata = async (imagePath) => {
  try {
    const tags = await ExifReader.load(imagePath, { expanded: true });
    
    const metadata = {
      file: {},
      exif: {},
      gps: {},
      iptc: {},
      xmp: {}
    };

    if (tags.file) {
      metadata.file = {
        size: tags.file.size?.value,
        type: tags.file.type?.description,
        mimeType: tags.file.MIMEType?.description
      };
    }

    if (tags.exif) {
      for (const [key, value] of Object.entries(tags.exif)) {
        if (value && value.description) {
          metadata.exif[key] = value.description;
        }
      }
    }

    if (tags.gps) {
      for (const [key, value] of Object.entries(tags.gps)) {
        if (value && value.description) {
          metadata.gps[key] = value.description;
        }
      }
    }

    if (tags.iptc) {
      for (const [key, value] of Object.entries(tags.iptc)) {
        if (value && value.description) {
          metadata.iptc[key] = value.description;
        }
      }
    }

    if (tags.xmp) {
      for (const [key, value] of Object.entries(tags.xmp)) {
        if (value && value.description) {
          metadata.xmp[key] = value.description;
        }
      }
    }

    return metadata;
  } catch (error) {
    throw new Error(`Failed to read metadata: ${error.message}`);
  }
};

module.exports.getBasicInfo = async (imagePath) => {
  try {
    const tags = await ExifReader.load(imagePath, { expanded: true });
    
    return {
      width: tags.exif?.ImageWidth?.value || tags.exif?.PixelXDimension?.value,
      height: tags.exif?.ImageHeight?.value || tags.exif?.PixelYDimension?.value,
      dateTime: tags.exif?.DateTimeOriginal?.description || tags.exif?.DateTime?.description,
      make: tags.exif?.Make?.description,
      model: tags.exif?.Model?.description,
      software: tags.exif?.Software?.description,
      orientation: tags.exif?.Orientation?.description,
      colorSpace: tags.exif?.ColorSpace?.description,
      exposureTime: tags.exif?.ExposureTime?.description,
      fNumber: tags.exif?.FNumber?.description,
      iso: tags.exif?.ISOSpeedRatings?.description,
      focalLength: tags.exif?.FocalLength?.description,
      gpsLatitude: tags.gps?.Latitude?.description,
      gpsLongitude: tags.gps?.Longitude?.description,
      imageDescription: tags.exif?.ImageDescription?.description,
      artist: tags.exif?.Artist?.description,
      copyright: tags.exif?.Copyright?.description
    };
  } catch (error) {
    throw new Error(`Failed to read basic info: ${error.message}`);
  }
};
