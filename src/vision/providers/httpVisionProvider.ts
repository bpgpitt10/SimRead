import { readFile } from 'fs/promises';
import type { ExtractedFrame } from '../../types/extractionTypes';
import type { VisionProvider } from '../VisionProvider';

export class HttpVisionProvider implements VisionProvider {
  async extract(imagePath: string, mode: "practice" | "course"): Promise<ExtractedFrame> {
    const buffer = await readFile(imagePath);
    const imageBase64 = buffer.toString('base64');

    const response = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64,
        mode
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vision server error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as ExtractedFrame;
    return data;
  }
}