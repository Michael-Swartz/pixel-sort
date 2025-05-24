'use client';

import { useState, useEffect, useRef } from 'react';

// Define a type for our extended p5 instance - using type import to avoid actual import
import type p5 from 'p5';
interface ExtendedP5 extends p5 {
  updateWithImage?: (file: File) => void;
  startPixelSort?: (options: SortOptions) => void;
  downloadSortedImage?: (useDisplaySize?: boolean) => void;
  sortedImg?: p5.Image | null;
  originalImg?: p5.Image | null;
  isPixelSorted?: boolean;
}

// Define a type for our sort options
interface SortOptions {
  sortMode: 'brightness' | 'hue' | 'saturation' | 'color';
  threshold: number;
  sortDirection: 'ascending' | 'descending';
  sortLength: number;    // New parameter for length of sorted sections
  noiseThreshold: number; // New parameter for noise reduction
  sortIntensity: number; // New parameter for sort intensity
  sliceWidth: number;    // New parameter for width of unsorted vertical slices
  sortAngle: number;    // New parameter for sort angle (degrees)
}

const P5Sketch = () => {
  const sketchRef = useRef<HTMLDivElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const p5Instance = useRef<ExtendedP5 | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [hasSortedImage, setHasSortedImage] = useState(false);
  const [sortProgress, setSortProgress] = useState(0);
  
  // Sort configuration state
  const [sortMode, setSortMode] = useState<'brightness' | 'hue' | 'saturation' | 'color'>('brightness');
  const [threshold, setThreshold] = useState<number>(127); // 0-255
  const [sortDirection, setSortDirection] = useState<'ascending' | 'descending'>('ascending');
  const [sortLength, setSortLength] = useState<number>(50);    // New state for length
  const [noiseThreshold, setNoiseThreshold] = useState<number>(10); // New state for noise
  const [sortIntensity, setSortIntensity] = useState<number>(100);  // New state for intensity
  const [sliceWidth, setSliceWidth] = useState<number>(0);     // New state for slice width
  const [sortAngle, setSortAngle] = useState<number>(0);    // New state for sort angle (degrees)
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
      setIsSorting(false); // Reset sorting state when new image is uploaded
    }
  };

  // Handle pixel sort button click
  const handlePixelSortClick = () => {
    if (!imageFile || !p5Instance.current) return;
    
    setIsSorting(true);
    setHasSortedImage(false);
    setSortProgress(0);
    
    // Reset the sorted image
    if (p5Instance.current.sortedImg) {
      p5Instance.current.sortedImg = null;
    }
    
    // Start pixel sorting
    if (p5Instance.current.startPixelSort) {
      p5Instance.current.startPixelSort({
        sortMode,
        threshold,
        sortDirection,
        sortLength,
        noiseThreshold,
        sortIntensity,
        sliceWidth,
        sortAngle,
      });
    }
  };
  
  // Download the sorted image
  const handleDownload = () => {
    if (p5Instance.current && hasSortedImage) {
      const p5 = p5Instance.current;
      
      // Use p5's save function to directly save the canvas
      // This will automatically extract just the visible portion of the sorted image
      // Add a custom function to the p5 sketch to handle this
      if (p5.downloadSortedImage) {
        p5.downloadSortedImage();
      }
    }
  };
  
  // Rotate image handler
  const handleRotate = () => {
    if (p5Instance.current && p5Instance.current.originalImg) {
      const p5 = p5Instance.current;
      const src = p5.originalImg;
      if (!src) return;
      // Create a new image with swapped width/height
      const rotated = p5.createImage(src.height, src.width);
      src.loadPixels();
      rotated.loadPixels();
      // Rotate 90 degrees clockwise
      for (let x = 0; x < src.width; x++) {
        for (let y = 0; y < src.height; y++) {
          const srcIdx = 4 * (y * src.width + x);
          const dstX = src.height - 1 - y;
          const dstY = x;
          const dstIdx = 4 * (dstY * rotated.width + dstX);
          rotated.pixels[dstIdx] = src.pixels[srcIdx];
          rotated.pixels[dstIdx + 1] = src.pixels[srcIdx + 1];
          rotated.pixels[dstIdx + 2] = src.pixels[srcIdx + 2];
          rotated.pixels[dstIdx + 3] = src.pixels[srcIdx + 3];
        }
      }
      rotated.updatePixels();
      // Set as new original image
      p5.originalImg = rotated;
      // Clear sorted image
      p5.sortedImg = null;
      // Force redraw
      p5.redraw();
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
        p.setup = () => {
          // Create wider canvas to accommodate both images side by side
          p.createCanvas(1200, 500);
          p.background(220);
        };
        
        p.draw = () => {
          p.background(220);
          
          // Display the images if loaded
          if (p.originalImg) {
            // Calculate aspect ratio to fit the original image within half the canvas
            const ratio = Math.min(
              p.width / 2 / p.originalImg.width,
              p.height / p.originalImg.height
            ) * 0.9; // 90% to leave some margin
            
            const imgWidth = p.originalImg.width * ratio;
            const imgHeight = p.originalImg.height * ratio;
            
            // Position original image on the left side
            const x1 = (p.width / 4) - (imgWidth / 2);
            const y1 = (p.height - imgHeight) / 2;
            
            // Draw original image (no rotation)
            p.image(p.originalImg, x1, y1, imgWidth, imgHeight);
            
            // Draw label for original image
            p.fill(0);
            p.textSize(16);
            p.textAlign(p.CENTER);
            p.text("Original Image", p.width / 4, 30);
            
            // Draw sorted image if available, otherwise show placeholder
            p.textAlign(p.CENTER);
            p.text("Sorted Image", p.width * 3/4, 30);
            
            if (p.sortedImg) {
              // Position sorted image on the right side
              const x2 = (p.width * 3/4) - (imgWidth / 2);
              const y2 = (p.height - imgHeight) / 2;
              p.image(p.sortedImg, x2, y2, imgWidth, imgHeight);
            } else {
              // Show placeholder for sorted image
              p.fill(180);
              p.textAlign(p.CENTER, p.CENTER);
              p.text(
                isSorting ? "Processing..." : "Click 'Pixel Sort' to see result", 
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
            p.originalImg = loadedImg;
            p.sortedImg = null;
            
            // Revoke the object URL to free memory
            URL.revokeObjectURL(objectURL);
          }, () => {
            console.error('Error loading image');
          });
        };

        // Pixel sorting function
        p.startPixelSort = (options: SortOptions) => {
          if (!p.originalImg) return;
          
          // Get sort options from parameters
          const { 
            sortMode, threshold, sortDirection, sortLength, 
            noiseThreshold, sortIntensity, sliceWidth,
            sortAngle
          } = options;
          
          // Create a copy of the original image for sorting
          const sortedImg = p.createImage(p.originalImg.width, p.originalImg.height);
          sortedImg.copy(
            p.originalImg, 
            0, 0, p.originalImg.width, p.originalImg.height, 
            0, 0, p.originalImg.width, p.originalImg.height
          );
          
          // Load pixels for manipulation
          sortedImg.loadPixels();
          
          // Process in chunks to keep UI responsive
          const chunkSize = 10; // Number of lines to process per chunk
          let currentLine = 0;
          
          const processChunk = () => {
            // For 0°: process columns (vertical). For 90°: process rows (horizontal).
            const isHorizontal = Math.abs(sortAngle % 180) === 90;
            const maxLines = isHorizontal ? sortedImg!.height : sortedImg!.width;
            const endLine = Math.min(currentLine + chunkSize, maxLines);
            for (let line = currentLine; line < endLine; line++) {
              // Extract the line of pixels
              const linePixels: Array<[number, number, number, number, number, number?]> = [];
              for (let i = 0; i < (isHorizontal ? sortedImg!.width : sortedImg!.height); i++) {
                let idx;
                if (isHorizontal) {
                  // horizontal: x = i, y = line
                  idx = (line * sortedImg!.width + i) * 4;
                } else {
                  // vertical: x = line, y = i
                  idx = (i * sortedImg!.width + line) * 4;
                }
                linePixels.push([
                  sortedImg!.pixels[idx],
                  sortedImg!.pixels[idx + 1],
                  sortedImg!.pixels[idx + 2],
                  sortedImg!.pixels[idx + 3],
                  idx
                ]);
              }
              
              // Calculate pixel values based on selected sort mode
              linePixels.forEach(pixel => {
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
                } else if (sortMode === 'color') {
                  // Create a single value that represents the color
                  // This combines RGB values in a way that preserves color relationships
                  // Using a weighted sum that gives more importance to the dominant color
                  const max = Math.max(r, g, b);
                  const min = Math.min(r, g, b);
                  const delta = max - min;
                  
                  // Calculate color value based on dominant color and intensity
                  let colorValue = 0;
                  if (delta === 0) {
                    // Grayscale
                    colorValue = r;
                  } else {
                    // Color
                    if (max === r) {
                      colorValue = 256 * 0 + g;
                    } else if (max === g) {
                      colorValue = 256 * 1 + b;
                    } else {
                      colorValue = 256 * 2 + r;
                    }
                    // Add intensity component
                    colorValue += delta * 256 * 3;
                  }
                  pixel.push(colorValue);
                }
              });
              
              // Apply noise reduction
              if (noiseThreshold > 0) {
                linePixels.forEach((pixel, i) => {
                  if (i > 0 && i < linePixels.length - 1) {
                    const prevPixel = linePixels[i - 1];
                    const nextPixel = linePixels[i + 1];
                    const currentValue = pixel[5] ?? 0;
                    const prevValue = prevPixel[5] ?? 0;
                    const nextValue = nextPixel[5] ?? 0;
                    
                    // If the difference between adjacent pixels is less than noise threshold,
                    // average them out
                    if (Math.abs(currentValue - prevValue) < noiseThreshold &&
                        Math.abs(currentValue - nextValue) < noiseThreshold) {
                      pixel[5] = (prevValue + currentValue + nextValue) / 3;
                    }
                  }
                });
              }
              
              // Apply threshold filter - only sort pixels above the threshold
              const thresholdValue = threshold;
              const pixelsAboveThreshold: Array<[number, number, number, number, number, number?]> = [];
              const pixelsBelowThreshold: Array<[number, number, number, number, number, number?]> = [];
              
              linePixels.forEach(pixel => {
                const value = pixel[5]; // The sort value we just added
                if ((sortMode === 'brightness' || sortMode === 'color') && value !== undefined && value >= thresholdValue) {
                  pixelsAboveThreshold.push(pixel);
                } else if ((sortMode === 'hue' || sortMode === 'saturation') && value !== undefined && value >= thresholdValue / 2.55) {
                  // Normalize threshold from 0-255 to 0-100 for saturation, 0-360 for hue
                  pixelsAboveThreshold.push(pixel);
                } else {
                  pixelsBelowThreshold.push(pixel);
                }
              });
              
              // Sort pixels above threshold in sections
              const sortedSections: Array<[number, number, number, number, number, number?]> = [];
              
              // Calculate total section width (sort length + slice width)
              const totalSectionWidth = sortLength + sliceWidth;
              
              // Process each section
              for (let x = 0; x < sortedImg!.width; x += totalSectionWidth) {
                // Get pixels for this section
                const sectionStart = x;
                const sectionEnd = Math.min(x + sortLength, sortedImg!.width);
                const section = pixelsAboveThreshold.filter(pixel => {
                  const pixelX = (pixel[4] / 4) % sortedImg!.width;
                  return pixelX >= sectionStart && pixelX < sectionEnd;
                });
                
                // Apply intensity-based sorting to the section
                if (sortIntensity < 100) {
                  // Only sort a portion of the pixels based on intensity
                  const pixelsToSort = Math.floor(section.length * (sortIntensity / 100));
                  const sortedPart = section.slice(0, pixelsToSort);
                  const unsortedPart = section.slice(pixelsToSort);
                  
                  sortedPart.sort((a, b) => {
                    const valueA = a[5] ?? 0;
                    const valueB = b[5] ?? 0;
                    return sortDirection === 'ascending' ? valueA - valueB : valueB - valueA;
                  });
                  
                  sortedSections.push(...sortedPart, ...unsortedPart);
                } else {
                  // Sort all pixels in the section
                  section.sort((a, b) => {
                    const valueA = a[5] ?? 0;
                    const valueB = b[5] ?? 0;
                    return sortDirection === 'ascending' ? valueA - valueB : valueB - valueA;
                  });
                  sortedSections.push(...section);
                }
                
                // Add unsorted pixels between sections based on sortInterval
                if (x + sortLength < sortedImg!.width) {
                  const unsortedSection = pixelsAboveThreshold.filter(pixel => {
                    const pixelX = (pixel[4] / 4) % sortedImg!.width;
                    return pixelX >= sectionEnd && pixelX < x + totalSectionWidth;
                  });
                  sortedSections.push(...unsortedSection);
                }
              }
              
              // Combine sorted sections with unsorted pixels below threshold
              const sortedRow = [...pixelsBelowThreshold, ...sortedSections];
              
              // Put pixels back in original order
              for (let i = 0; i < linePixels.length; i++) {
                const pixel = sortedRow[i];
                if (pixel) {
                  let idx;
                  if (isHorizontal) {
                    // horizontal: x = i, y = line
                    idx = (line * sortedImg!.width + i) * 4;
                  } else {
                    // vertical: x = line, y = i
                    idx = (i * sortedImg!.width + line) * 4;
                  }
                  sortedImg!.pixels[idx] = pixel[0];      // R
                  sortedImg!.pixels[idx + 1] = pixel[1];  // G
                  sortedImg!.pixels[idx + 2] = pixel[2];  // B
                  sortedImg!.pixels[idx + 3] = pixel[3];  // A
                }
              }
            }
            
            // Update current line position
            currentLine = endLine;
            
            // Calculate and update progress
            const progress = (currentLine / maxLines) * 100;
            setSortProgress(progress);
            
            // Show progress by updating the pixels after each chunk
            sortedImg!.updatePixels();
            p.sortedImg = sortedImg;
            
            // Continue processing if not done
            if (currentLine < maxLines) {
              // Schedule next chunk with a small delay to allow UI updates
              setTimeout(processChunk, 0);
            } else {
              // All done
              setHasSortedImage(true);
              setIsSorting(false);
              setSortProgress(100);
            }
          };
          
          // Start processing the first chunk
          processChunk();
        };
        
        // Custom function to download the sorted image
        p.downloadSortedImage = (useDisplaySize = false) => {
          if (!p.sortedImg) return;
          
          let imgToDownload = p.sortedImg;
          let width = p.sortedImg.width;
          let height = p.sortedImg.height;
          
          if (useDisplaySize && p.originalImg) {
            // Calculate the display size based on canvas dimensions
            const ratio = Math.min(
              p.width / 2 / p.originalImg.width,
              p.height / p.originalImg.height
            ) * 0.9; // 90% to leave some margin
            
            width = Math.round(p.originalImg.width * ratio);
            height = Math.round(p.originalImg.height * ratio);
            
            // Create a resized version of the image
            const resized = p.createImage(width, height);
            imgToDownload.loadPixels();
            resized.loadPixels();
            
            // Resize the image using p5's built-in resize
            imgToDownload.resize(width, height);
            imgToDownload = imgToDownload; // Use the resized image
          }
          
          // Create a temporary canvas to draw just the sorted image
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          
          
          const ctx = tempCanvas.getContext('2d');
          if (!ctx) return;
          
          // Draw only the sorted image onto the canvas
          imgToDownload.loadPixels(); // Make sure pixels are loaded
          const imageData = new ImageData(
            new Uint8ClampedArray(imgToDownload.pixels),
            width,
            height
          );
          ctx.putImageData(imageData, 0, 0);
          
          // Convert canvas to data URL
          const dataURL = tempCanvas.toDataURL('image/png');
          
          // Create a link element to trigger download
          const a = document.createElement('a');
          a.href = dataURL;
          a.download = 'pixel-sorted-image.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
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
  }, [imageFile]); // Added imageFile as dependencies
  
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
          className={`font-bold py-2 px-4 rounded relative ${
            !imageFile ? 
              'bg-gray-400 cursor-not-allowed' : 
              isSorting ? 
                'bg-gray-500' : 
                'bg-green-500 hover:bg-green-700 text-white cursor-pointer'
          }`}
        >
          {isSorting ? (
            <>
              <span className="opacity-0">Pixel Sort</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
              </div>
            </>
          ) : 'Pixel Sort'}
        </button>
        <button
          onClick={handleRotate}
          disabled={!imageFile || isSorting}
          className={`font-bold py-2 px-4 rounded bg-yellow-500 hover:bg-yellow-600 text-white ${(!imageFile || isSorting) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Rotate
        </button>
      </div>
      
      {/* Sort controls */}
      {imageFile && (
        <div className="w-full max-w-4xl mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6 bg-gray-100 rounded-lg">
          {/* Sort Mode */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Sort By:</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="brightness"
                  checked={sortMode === 'brightness'}
                  onChange={() => setSortMode('brightness')}
                  className="w-4 h-4"
                />
                <span>Brightness</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="color"
                  checked={sortMode === 'color'}
                  onChange={() => setSortMode('color')}
                  className="w-4 h-4"
                />
                <span>Color</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="hue"
                  checked={sortMode === 'hue'}
                  onChange={() => setSortMode('hue')}
                  className="w-4 h-4"
                />
                <span>Hue</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortMode"
                  value="saturation"
                  checked={sortMode === 'saturation'}
                  onChange={() => setSortMode('saturation')}
                  className="w-4 h-4"
                />
                <span>Saturation</span>
              </label>
            </div>
          </div>
          
          {/* Threshold */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Threshold:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>chill</span>
                <span>cooked</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={255 - threshold}
                onChange={(e) => setThreshold(255 - parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
          
          {/* Sort Direction */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Direction:</label>
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortDirection"
                  value="ascending"
                  checked={sortDirection === 'ascending'}
                  onChange={() => setSortDirection('ascending')}
                  className="w-4 h-4"
                />
                <span>Ascending</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-800">
                <input
                  type="radio"
                  name="sortDirection"
                  value="descending"
                  checked={sortDirection === 'descending'}
                  onChange={() => setSortDirection('descending')}
                  className="w-4 h-4"
                />
                <span>Descending</span>
              </label>
            </div>
          </div>

          {/* Sort Length */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Sort Length:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>short</span>
                <span>long</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                value={sortLength}
                onChange={(e) => setSortLength(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Noise Threshold */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Noise Reduction:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>none</span>
                <span>max</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={noiseThreshold}
                onChange={(e) => setNoiseThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Sort Intensity */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Sort Intensity:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>subtle</span>
                <span>intense</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sortIntensity}
                onChange={(e) => setSortIntensity(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Slice Width */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Vertical Slices:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>none</span>
                <span>wide</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={sliceWidth}
                onChange={(e) => setSliceWidth(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Sort Angle */}
          <div className="flex flex-col space-y-3">
            <label className="text-base font-medium text-gray-800">Sort Angle:</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>0°</span>
                <span>90°</span>
                <span>180°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="90"
                value={sortAngle}
                onChange={(e) => setSortAngle(Math.round(parseInt(e.target.value) / 90) * 90)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center text-xs text-gray-500">{sortAngle}°</div>
            </div>
          </div>
        </div>
      )}
      
      <div ref={sketchRef}></div>
      
      {/* Progress bar */}
      {isSorting && (
        <div className="w-full flex flex-col items-center mt-4">
          <div className="w-full sm:w-[400px] md:w-[600px] bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${sortProgress}%` }}
            ></div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-600 w-full sm:w-[400px] md:w-[600px]">
            Processing: {Math.round(sortProgress)}%
          </div>
        </div>
      )}
      
      {/* Download button */}
      <button 
        onClick={handleDownload}
        disabled={!hasSortedImage}
        className={`mt-8 mb-6 py-3 px-6 rounded ${
          hasSortedImage ? 
            'bg-blue-500 hover:bg-blue-700 text-white cursor-pointer' : 
            'bg-gray-400 text-gray-300 cursor-not-allowed'
        }`}
      >
        Download
      </button>
    </div>
  );
};

export default P5Sketch;