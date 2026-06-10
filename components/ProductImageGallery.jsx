import { useState, useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

const ProductImageGallery = ({ product }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const thumbnailRef = useRef(null);

  // Ensure we have images
  const images = product?.images || [];
  const hasImages = images.length > 0;

  const handlers = useSwipeable({
    onSwipedLeft: () => nextImage(),
    onSwipedRight: () => prevImage(),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const nextImage = () => {
    if (!hasImages) return;
    
    setCurrentImageIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  const prevImage = () => {
    if (!hasImages) return;
    
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  useEffect(() => {
    if (!thumbnailRef.current || !hasImages || currentImageIndex >= images.length) {
      return;
    }

    const activeThumbnail = thumbnailRef.current.children[currentImageIndex];
    
    // Check if activeThumbnail exists
    if (!activeThumbnail) {
      return;
    }

    const offsetLeft = activeThumbnail.offsetLeft;
    const offsetWidth = activeThumbnail.offsetWidth;
    const containerWidth = thumbnailRef.current.offsetWidth;
    const scrollPosition = offsetLeft - (containerWidth / 2 - offsetWidth / 2);
    
    thumbnailRef.current.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  }, [currentImageIndex, hasImages, images.length]);

  // If no images, show a placeholder
  if (!hasImages) {
    return (
      <div className="md:w-1/2 p-6">
        <div className="relative sm:h-[45rem] h-[30rem] mb-6 bg-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="md:w-1/2 p-6">
      <div className="relative sm:h-[45rem] h-[30rem] mb-6" {...handlers}>
        <Image
          src={images[currentImageIndex]}
          alt={product?.name || "Product image"}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="rounded-lg object-cover"
          priority
        />
        {images.length > 1 && (
          <>
            <div className="absolute inset-y-0 left-0 flex items-center pl-2">
              <button
                onClick={prevImage}
                className="bg-white/80 rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 text-gray-700" />
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <button
                onClick={nextImage}
                className="bg-white/80 rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 text-gray-700" />
              </button>
            </div>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentImageIndex === index 
                      ? "bg-blue-500 w-4" 
                      : "bg-white/60 hover:bg-white/80"
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      {images.length > 1 && (
        <div className="relative">
          <div
            className="flex space-x-4 overflow-x-auto pb-4 pt-2 px-2 hide-scrollbar"
            ref={thumbnailRef}
          >
            {images.map((image, index) => (
              <div
                key={index}
                className={`relative w-20 h-20 flex-shrink-0 cursor-pointer transition-all duration-300 ${
                  currentImageIndex === index
                    ? "ring-2 ring-blue-500 ring-offset-2"
                    : "opacity-70 hover:opacity-100"
                }`}
                onClick={() => setCurrentImageIndex(index)}
              >
                <Image
                  src={image}
                  alt={`${product?.name || "Product"} - Image ${index + 1}`}
                  fill
                  sizes="80px"
                  className="rounded-lg object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;