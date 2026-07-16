import Spine from './components/Spine';
import TopBar from './components/TopBar';
import UploadStage from './components/UploadStage';
import ChaptersStage from './components/ChaptersStage';
import PolishStage from './components/PolishStage';
import FrontMatterStage from './components/FrontMatterStage';
import IndexStage from './components/IndexStage';
import CoverStage from './components/CoverStage';
import ExportStage from './components/ExportStage';
import { useBookStore } from './store/useBookStore';

export default function App() {
  const stage = useBookStore((s) => s.stage);

  return (
    <div className="flex h-screen bg-ink bg-grain">
      <Spine />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {stage === 'upload' && <UploadStage />}
          {stage === 'chapters' && <ChaptersStage />}
          {stage === 'polish' && <PolishStage />}
          {stage === 'front-matter' && <FrontMatterStage />}
          {stage === 'index' && <IndexStage />}
          {stage === 'cover' && <CoverStage />}
          {stage === 'export' && <ExportStage />}
        </main>
      </div>
    </div>
  );
}
