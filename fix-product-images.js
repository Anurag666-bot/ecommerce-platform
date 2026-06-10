const { MongoClient } = require('mongodb');

async function fixProductImages() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('projectEcom');
    
    const products = await db.collection('products').find({}).toArray();
    
    console.log(`Found ${products.length} products to check`);
    
    for (const product of products) {
      if (product.images && product.images.length > 0) {
        const validImages = [];
        
        for (const img of product.images) {
          try {
            const url = new URL(img);
            if (url.protocol === 'https:') {
              validImages.push(img);
            } else if (url.protocol === 'http:') {
              // Convert HTTP to HTTPS
              const httpsUrl = img.replace('http://', 'https://');
              validImages.push(httpsUrl);
              console.log(`  Converted to HTTPS: ${httpsUrl.substring(0, 50)}...`);
            }
          } catch (e) {
            console.log(`  Removing invalid URL: ${img.substring(0, 50)}...`);
          }
        }
        
        // Update product if images changed
        if (validImages.length !== product.images.length) {
          await db.collection('products').updateOne(
            { _id: product._id },
            { $set: { images: validImages } }
          );
          console.log(`✅ Updated images for: ${product.name}`);
        }
      }
    }
    
    console.log('\n✅ Image cleanup complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixProductImages();
