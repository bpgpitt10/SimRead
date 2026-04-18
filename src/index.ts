import { HttpVisionProvider } from './vision/providers/httpVisionProvider';

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: npx ts-node src/index.ts practice ./images/practice/example.png');
    console.error('       npx ts-node src/index.ts course ./images/course/example.png');
    process.exit(1);
  }

  const [mode, imagePath] = args;

  if (mode !== 'practice' && mode !== 'course') {
    console.error('Mode must be "practice" or "course"');
    process.exit(1);
  }

  const provider = new HttpVisionProvider();

  try {
    const result = await provider.extract(imagePath!, mode as "practice" | "course");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();