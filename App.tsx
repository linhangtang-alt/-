import React, { useState } from 'react';
import { AppView } from './types';
import GeneratorView from './components/GeneratorView';
import PlayerView from './components/PlayerView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.GENERATOR);
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);

  return (
    <div className="h-full w-full">
      {currentView === AppView.GENERATOR ? (
        <GeneratorView 
          onNavigate={setCurrentView} 
          onVideoUpload={setUploadedVideo}
        />
      ) : (
        <PlayerView 
          onNavigate={setCurrentView} 
          uploadedVideo={uploadedVideo}
        />
      )}
    </div>
  );
};

export default App;