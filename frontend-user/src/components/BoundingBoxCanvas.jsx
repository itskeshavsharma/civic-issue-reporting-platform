import React, { useRef, useEffect } from 'react';

const BoundingBoxCanvas = ({ imageUrl, boundingBox }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    const draw = () => {
      // Set canvas dimensions to match the displayed image dimensions
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Calculate scaling factors in case the image is scaled by CSS
      const scaleX = img.width / img.naturalWidth;
      const scaleY = img.height / img.naturalHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (boundingBox && boundingBox.length === 4) {
        const [x1, y1, x2, y2] = boundingBox;
        
        // Draw the red bounding box
        ctx.strokeStyle = '#ef4444'; // Tailwind red-500
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Scale the bounding box coordinates
        ctx.rect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
        ctx.stroke();
        
        // Add a slight semi-transparent fill
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fill();
      }
    };

    if (img.complete) {
      draw();
    } else {
      img.onload = draw;
    }
  }, [imageUrl, boundingBox]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-sm">
      <img 
        ref={imageRef} 
        src={imageUrl} 
        alt="Captured Issue" 
        className="w-full h-auto object-contain block"
      />
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};

export default BoundingBoxCanvas;
