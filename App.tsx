import React, { useState } from 'react';
import { AppView, SavedSession, ChatMessage, GeneratedArtifacts, SemanticVideoData } from './types';
import GeneratorView from './components/GeneratorView';
import PlayerView from './components/PlayerView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.GENERATOR);
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [history, setHistory] = useState<SavedSession[]>([]);

  // Called when a NEW video is uploaded or generated
  const handleNewSession = (
      file: File | null, 
      artifacts?: GeneratedArtifacts, 
      videoUrl?: string,
      semanticData?: SemanticVideoData
    ) => {
    const newSession: SavedSession = {
      id: Date.now().toString(),
      videoFile: file || undefined,
      videoUrl: videoUrl,
      videoName: file?.name || "Generated Video",
      timestamp: Date.now(),
      chatHistory: [],
      lastAccessed: Date.now(),
      artifacts: artifacts,
      semanticData: semanticData
    };
    
    setHistory(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    setCurrentView(AppView.PLAYER);
  };

  // Called when clicking a history item
  const handleLoadSession = (sessionId: string) => {
    const session = history.find(s => s.id === sessionId);
    if (session) {
      setActiveSession({ ...session, lastAccessed: Date.now() });
      setCurrentView(AppView.PLAYER);
    }
  };

  // Called when PlayerView updates chat (e.g. on exit or real-time)
  const handleUpdateSession = (sessionId: string, newHistory: ChatMessage[]) => {
    setHistory(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, chatHistory: newHistory, lastAccessed: Date.now() } 
        : s
    ));
    
    // Also update active session ref to avoid stale state if re-entering immediately
    if (activeSession && activeSession.id === sessionId) {
        setActiveSession(prev => prev ? { ...prev, chatHistory: newHistory } : null);
    }
  };

  return (
    <div className="h-full w-full">
      {currentView === AppView.GENERATOR ? (
        <GeneratorView 
          onNavigate={setCurrentView} 
          onVideoUpload={handleNewSession}
          history={history}
          onLoadSession={handleLoadSession}
        />
      ) : (
        <PlayerView 
          onNavigate={setCurrentView} 
          session={activeSession}
          onUpdateSession={handleUpdateSession}
        />
      )}
    </div>
  );
};

export default App;