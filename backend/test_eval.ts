import { config } from './src/config';
import { runNativeFilePipeline } from './src/lib/NativeFilePipeline';

console.log("Key starting with:", config.gemini.apiKey?.substring(0, 5));

async function run() {
  try {
    const res = await runNativeFilePipeline({
      studentName: 'Test Student',
      activityTitle: 'Test Title',
      activityType: 'assignment',
      courseName: 'Test Course',
      fileData: { buffer: Buffer.from('Hello world this is my assignment'), mimeType: 'text/plain', originalName: 'test.txt' }
    });
    console.log("Result:", res);
  } catch(e) {
    console.error("Fatal Error:", e);
  }
}
run();
