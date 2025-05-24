import P5Sketch from './components/P5Sketch';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Pixel Sorter</h1>
      <P5Sketch />
    </div>
  );
}
