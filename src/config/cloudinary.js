import { v2 as cloudinary } from 'cloudinary';

console.log(process.env.CLOUDINARY_CLOUD_NAME,"process.env.CLOUDINARY_CLOUD_NAME");
    
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = (fileBuffer, fileName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: `khatabook_customers/${Date.now()}_${fileName}`,
        folder: 'khatabook_customers'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(fileBuffer);
  });
};

export default cloudinary;
