'use client';

import { useState, useEffect, useRef } from 'react';

// Define a type for our extended p5 instance - using type import to avoid actual import
import type p5 from 'p5';
interface ExtendedP5 extends p5 {
  updateWithImage?: (file: File) => void;
  startPixelSort?: (options: SortOptions) => void;
}

// Define a type for our sort options
interface SortOptions {
  sortMode: 'brightness' | 'hue' | 'saturation';
  threshold: number;
  sortDirection: 'ascending' | 'descending';
}

const P5Sketch = () => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const p5Instance = useRef<ExtendedP5 | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  
  // Sort configuration state
  const [sortMode, setSortMode] = useState<'brightness' | 'hue' | 'saturation'>('brightness');
  const [threshold, setThreshold] = useState<number>(0); // 0-255
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
      setIsSorting(false); // Reset sorting state when new image is uploaded
    }
  };

  // Handle pixel sort button click
  const handlePixelSortClick = () => {
    if (p5Instance.current && p5Instance.current.startPixelSort) {
      setIsSorting(true);
      p5Instance.current.startPixelSort({
        sortMode,
        threshold,
        sortDirection
      });
    }
  };
  
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || sketchRef.current === null) return;

    // Dynamically import p5 only on the client side
    import('p5').then(p5Module => {
      const p5 = p5Module.default;
      
      // Define the sketch
      const sketch = (p: ExtendedP5) => {
        let originalImg: p5.Image | null = null;
        let sortedImg: p5.Image | null = null;
        let isPixelSorted = false;
        
        p.setup = () => {
          // Create wider canvas to accommodate both images side by side
          p.createCanvas(1200, 600);
          p.background(220);
        };
        
        p.draw = () => {
          p.background(220);
          
          // Display the images if loaded
          if (originalImg) {
            // Calculate aspect ratio to fit the original image within half the canvas
            const ratio = Math.min(
              p.width / 2 / originalImg.width,
              p.height / originalImg.height
            ) * 0.9; // 90% to leave some margin
            
            const imgWidth = originalImg.width * ratio;
            const imgHeight = originalImg.height * ratio;
            
            // Position original image on the left side
            const x1 = (p.width / 4) - (imgWidth / 2);
            const y1 = (p.height - imgHeight) / 2;
            
            // Draw original image
            p.image(originalImg, x1, y1, imgWidth, imgHeight);
            
            // Draw label for original image
            p.fill(0);
            p.textSize(16);
            p.textAlign(p.CENTER);
            p.text("Original Image", p.width / 4, 30);
            
            // Draw sorted image if available, otherwise show placeholder
            p.textAlign(p.CENTER);
            p.text("Sorted Image", p.width * 3/4, 30);
            
            if (sortedImg && isPixelSorted) {
              // Position sorted image on the right side
              const x2 = (p.width * 3/4) - (imgWidth / 2);
              const y2 = (p.height - imgHeight) / 2;
              
              p.image(sortedImg, x2, y2, imgWidth, imgHeight);
            } else {
              // Show placeholder for sorted image
              p.fill(180);
              p.textAlign(p.CENTER, p.CENTER);
              p.text(
                isPixelSorted ? "Processing..." : "Click 'Pixel Sort' to see result", 
                p.width * 3/4, 
                p.height/2
              );
            }
          } else if (!imageFile) {
            // Show a placeholder if no image is loaded
            p.fill(150);
            p.noStroke();
            p.textSize(16);
            p.textAlign(p.CENTER, p.CENTER);
            p.text("Upload an image to display it", p.width/2, p.height/2);
          }
        };
        
        // Load image when imageFile changes
        p.updateWithImage = (file: File) => {
          const objectURL = URL.createObjectURL(file);
          p.loadImage(objectURL, loadedImg => {
            originalImg = loadedImg;
            sortedImg = null;
            isPixelSorted = false;
            
            // Revoke the object URL to free memory
            URL.revokeObjectURL(objectURL);
          }, () => {
            console.error('Error loading image');
          });
        };

        // Pixel sorting function
        p.startPixelSort = (options: SortOptions) => {
          if (!originalImg) return;
          
          // Get sort options from parameters
          const { sortMode, threshold, sortDirection } = options;
          
          // Create a copy of the original image for sorting
          sortedImg = p.createImage(originalImg.width, originalImg.height);
          sortedImg.copy(
            originalImg, 
            0, 0, originalImg.width, originalImg.height, 
            0, 0, originalImg.width, originalImg.height
          );
          
          // Load pixels for manipulation
          sortedImg.loadPixels();
          
          // Pixel sort each row independently
          for (let y = 0; y < sortedImg.height; y++) {
            // Extract the row of pixels
            const row: any[] = [];
            for (let x = 0; x < sortedImg.width; x++) {
              const i = (y * sortedImg.width + x) * 4;
              // Store pixel as [r,g,b,a,index] to remember original position
              row.push([
                sortedImg.pixels[i],
                sortedImg.pixels[i + 1],
                sortedImg.pixels[i + 2],
                sortedImg.pixels[i + 3],
                i
              ]);
            }
            
            // Calculate pixel values based on selected sort mode
            row.forEach(pixel => {
              const r = pixel[0];
              const g = pixel[1];
              const b = pixel[2];
              
              // Add sort value as the 5th element
              if (sortMode === 'brightness') {
                // Use average of RGB for brightness
                const brightness = (r + g + b) / 3;
                pixel.push(brightness);
              } else if (sortMode === 'hue') {
                // Convert RGB to HSL to get hue
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                let hue = 0;
                
                if (max === min) {
                  hue = 0; // no color, achromatic (gray)
                } else {
                  const d = max - min;
                  if (max === r) {
                    hue = (g - b) / d + (g < b ? 6 : 0);
                  } else if (max === g) {
                    hue = (b - r) / d + 2;
                  } else if (max === b) {
                    hue = (r - g) / d + 4;
                  }
                  hue *= 60;
                }
                pixel.push(hue);
              } else if (sortMode === 'saturation') {
                // Convert RGB to HSL to get saturation
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const l = (max + min) / 2;
                
                let saturation = 0;
                if (max !== min) {
                  const d = max - min;
                  saturation = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                }
                pixel.push(saturation * 100);
              }
            });
            
            // Apply threshold filter - only sort pixels above the threshold
            const thresholdValue = threshold;
            let pixelsAboveThreshold: any[] = [];
            let pixelsBelowThreshold: any[] = [];
            
            row.forEach(pixel => {
              const value = pixel[5]; // The sort value we just added
              if (sortMode === 'brightness' && value >= thresholdValue) {
                pixelsAboveThreshold.push(pixel);
              } else if ((sortMode === 'hue' || sortMode === 'saturation') && value >= thresholdValue / 2.55) {
                // Normalize threshold from 0-255 to 0-100 for saturation, 0-360 for hue
                pixelsAboveThreshold.push(pixel);
              } else {
                pixelsBelowThreshold.push(pixel);
              }
            });
            
            // Sort pixels above threshold
            pixelsAboveThreshold.sort((a, b) => {
              const valueA = a[5];
              const valueB = b[5];
              return sortDirection === 'ascending' ? valueA - valueB : valueB - valueA;
            });
            
            // Combine sorted pixels above threshold with unsorted pixels below threshold
            const sortedRow = [...pixelsBelowThreshold, ...pixelsAboveThreshold];
            
            // Put pixels back in original order
            for (let x = 0; x < sortedImg.width; x++) {
              const pixel = sortedRow[x];
              const i = (y * sortedImg.width + x) * 4;
              sortedImg.pixels[i] = pixel[0];      // R
              sortedImg.pixels[i + 1] = pixel[1];  // G
              sortedImg.pixels[i + 2] = pixel[2];  // B
              sortedImg.pixels[i + 3] = pixel[3];  // A
            }
          }
          
          // Update the pixels in the image
          sortedImg.updatePixels();
          isPixelSorted = true;
          
          // Finish sorting and update UI state
          setTimeout(() => {
            setIsSorting(false);
          }, 0);
        };
      };
      
      // Create the canvas with the sketch
      const p5Obj = new p5(sketch, sketchRef.current as HTMLElement);
      p5Instance.current = p5Obj as ExtendedP5;
      
      // If we already have an image file when initializing, load it
      if (imageFile && p5Instance.current && p5Instance.current.updateWithImage) {
        p5Instance.current.updateWithImage(imageFile);
      }
    });
    
    // Cleanup function to remove sketch when component unmounts
    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, []); // Empty dependency array to run only once on mount
  
  // Effect to handle image updates
  useEffect(() => {
    if (imageFile && p5Instance.current && p5Instance.current.updateWithImage) {
      p5Instance.current.updateWithImage(imageFile);
    }
  }, [imageFile]);
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="mb-4 flex gap-4">
        <label htmlFor="image-upload" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer">
          Upload Photo
          <input 
            id="image-upload"
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="hidden"
          />
        </label>
        <button 
          onClick={handlePixelSortClick}
          disabled={!imageFile || isSorting}
          className={`font-bold py-2 px-4 rounded ${
            !imageFile ? 
              'bg-gray-400 cursor-not-allowed' : 
              isSorting ? 
                'bg-gray-500 cursor-wait' : 
                'bg-green-500 hover:bg-green-700 text-white cursor-pointer'
          }`}
        >
          {isSorting ? 'Sorting...' : 'Pixel Sort'}
        </button>
      </div>
      
      {/* Sort controls */}
      {imageFile && (
        <div className="w-full max-w-4xl mb-4 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-gray-100 rounded-lg">
          {/* Sort Mode */}
          <div className="flex flex-col">
            <label className="mb-2 text-base font-medium text-gray-800">Sort By:</label>
            <div className="flex gap-4">
              <label className="flex items-center text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="brightness"
                  checked={sortMode === 'brightness'}
                  onChange={() => setSortMode('brightness')}
                  className="mr-2"
                />
                Brightness
              </label>
              <label className="flex items-center text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="hue"
                  checked={sortMode === 'hue'}
                  onChange={() => setSortMode('hue')}
                  className="mr-2"
                />
                Hue
              </label>
              <label className="flex items-center text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="saturation"
                  checked={sortMode === 'saturation'}
                  onChange={() => setSortMode('saturation')}
                  className="mr-2"
                />
                Saturation
              </label>
            </div>
          </div>
          
          {/* Threshold */}
          <div className="flex flex-col">
            <label className="mb-2 text-base font-medium text-gray-800">Threshold: <span className="font-bold">{threshold}</span></label>
            <input
              type="range"
              min="0"
              max="255"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          
          {/* Sort Direction */}
          <div className="flex flex-col">
            <label className="mb-2 text-base font-medium text-gray-800">Direction:</label>
            <div className="flex gap-4">
              <label className="flex items-center text-gray-800">
                <input
                  type="radio"
                  name="sortDirection"
                  value="ascending"
                  checked={sortDirection === 'ascending'}
                  onChange={() => setSortDirection('ascending')}
                  className="mr-2"
                />
                Ascending
              </label>
              <label className="flex items-center text-gray-800">
                <input
                  type="radio"
                  name="sortDirection"
                  value="descending"
                  checked={sortDirection === 'descending'}
                  onChange={() => setSortDirection('descending')}
                  className="mr-2"
                />
                Descending
              </label>
            </div>
          </div>
        </div>
      )}
      
      <div ref={sketchRef}></div>
    </div>
  );
};

export default P5Sketch;