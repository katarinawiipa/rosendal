import React, { useState, useEffect } from 'react';
import { Volume2, Star, Sparkles, RefreshCw, Trophy, ArrowRight, Wand2, Loader2 } from 'lucide-react';

// Speldata - Ord för Åk 2 (Blandade fonemövningar)
const defaultLevelData = [
  {
    originalWord: "KATT",
    instruction: "Byt ut K mot H",
    targetWord: "HATT",
    options: ["HATT", "MATT", "RATT"]
  },
  {
    originalWord: "SAK",
    instruction: "Byt ut K i slutet mot L",
    targetWord: "SAL",
    options: ["SAL", "KAL", "DAL"]
  },
  {
    originalWord: "ÅR",
    instruction: "Lägg till H i början",
    targetWord: "HÅR",
    options: ["HÅR", "GÅR", "FÅR"]
  },
  {
    originalWord: "SOL",
    instruction: "Lägg till T efter S",
    targetWord: "STOL",
    options: ["STOL", "SKOL", "SPOL"]
  },
  {
    originalWord: "KO",
    instruction: "Lägg till R i slutet",
    targetWord: "KOR",
    options: ["KOR", "KOS", "KOT"]
  },
  {
    originalWord: "KRAM",
    instruction: "Ta bort K i början",
    targetWord: "RAM",
    options: ["RAM", "DAM", "KAM"]
  },
  {
    originalWord: "SMAL",
    instruction: "Ta bort M i mitten",
    targetWord: "SAL",
    options: ["SAL", "VAL", "MAL"]
  },
  {
    originalWord: "BILD",
    instruction: "Ta bort D i slutet",
    targetWord: "BIL",
    options: ["BIL", "PIL", "MIL"]
  },
  {
    originalWord: "SKOLA",
    instruction: "Byt ut K mot P",
    targetWord: "SPOLA",
    options: ["SPOLA", "SMOLA", "STOLA"]
  },
  {
    originalWord: "IS",
    instruction: "Lägg till R i början",
    targetWord: "RIS",
    options: ["RIS", "FIS", "DIS"]
  },
  {
    originalWord: "PLÅT",
    instruction: "Ta bort P i början",
    targetWord: "LÅT",
    options: ["LÅT", "VÅT", "BÅT"]
  },
  {
    originalWord: "MAT",
    instruction: "Byt ut T i slutet mot N",
    targetWord: "MAN",
    options: ["MAN", "KAN", "VAN"]
  },
  {
    originalWord: "KAM",
    instruction: "Lägg till R efter K",
    targetWord: "KRAM",
    options: ["KRAM", "FRAM", "GRAM"]
  },
  {
    originalWord: "VAGN",
    instruction: "Ta bort G i mitten",
    targetWord: "VAN",
    options: ["VAN", "MAN", "KAN"]
  },
  {
    originalWord: "DUK",
    instruction: "Byt ut U i mitten mot Y",
    targetWord: "DYK",
    options: ["DYK", "RYK", "KYL"]
  }
];

export default function App() {
  const [levels, setLevels] = useState(defaultLevelData);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null); // 'correct', 'incorrect', or null
  const [gameOver, setGameOver] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isGeneratingLevels, setIsGeneratingLevels] = useState(false);

  const level = levels[currentLevel];

  // Blanda svarsalternativen och dölj dem när en ny nivå laddas
  useEffect(() => {
    if (level) {
      const shuffled = [...level.options].sort(() => Math.random() - 0.5);
      setShuffledOptions(shuffled);
      setShowOptions(false);
    }
  }, [currentLevel, level]);

  // Skapar en WAV-fil av rå PCM-data från Gemini
  const createWavFile = (pcmData, sampleRate) => {
    const buffer = new ArrayBuffer(44 + pcmData.length);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    const pcmBytes = new Uint8Array(buffer, 44);
    pcmBytes.set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Enkel talsyntes om API:et inte är tillgängligt
  const fallbackSpeak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'sv-SE';
      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Funktion för att läsa upp text med Geminis verklighetstrogna AI-röst
  const speak = async (text) => {
    if (isGeneratingAudio) return;
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;// API-nyckel tillhandahålls av miljön i bakgrunden

    setIsGeneratingAudio(true);
    const maxRetries = 5;
    let delay = 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Say clearly in Swedish: ${text}` }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Kore" } // En klar och naturlig röst
                  }
                }
              }
            })
          }
        );

        if (!response.ok) {
           throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        
        if (inlineData && inlineData.data) {
          const binaryString = atob(inlineData.data);
          const pcmData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmData[i] = binaryString.charCodeAt(i);
          }

          let sampleRate = 24000;
          const rateMatch = inlineData.mimeType.match(/rate=(\d+)/);
          if (rateMatch) {
            sampleRate = parseInt(rateMatch[1], 10);
          }

          const wavBlob = createWavFile(pcmData, sampleRate);
          const audioUrl = URL.createObjectURL(wavBlob);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
             setIsGeneratingAudio(false);
             URL.revokeObjectURL(audioUrl); // Frigör minne
          };
          
          audio.play();
          return; // Avsluta loopen vid framgång
        } else {
          throw new Error("No audio data returned");
        }
      } catch (err) {
        if (attempt === maxRetries) {
          console.error("AI TTS misslyckades, använder inbyggd röst:", err);
          fallbackSpeak(text);
          setIsGeneratingAudio(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponentiell backoff vid fel
      }
    }
  };

  const handleOptionClick = (selectedWord) => {
    if (feedback !== null) return; // Förhindra klick under animering

    if (selectedWord === level.targetWord) {
      setFeedback('correct');
      setScore(score + 1);
      speak("Rätt! Bra jobbat!");
      
      setTimeout(() => {
        setFeedback(null);
        if (currentLevel + 1 < levels.length) {
          setCurrentLevel(currentLevel + 1);
        } else {
          setGameOver(true);
          speak("Spelet är slut! Du är en riktig ordmagiker!");
        }
      }, 2000);
    } else {
      setFeedback('incorrect');
      speak("Oj, försök igen!");
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const restartGame = () => {
    setCurrentLevel(0);
    setScore(0);
    setGameOver(false);
    setFeedback(null);
  };

  const generateNewLevels = async () => {
    setIsGeneratingLevels(true);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // API-nyckel tillhandahålls av miljön i bakgrunden

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: "Du är en expert på pedagogik för barn i åk 2. Skapa 5 helt nya och kluriga fonologiska övningar på svenska. Variera slumpmässigt mellan: 1. Fonembyte (t.ex. 'Byt ut K mot P' för SKOLA -> SPOLA, eller 'Byt ut T i slutet mot N' för MAT -> MAN), 2. Fonemaddition (t.ex. 'Lägg till T efter S' för SOL -> STOL, 'Lägg till R i slutet' för KO -> KOR, 'Lägg till H i början' för ÅR -> HÅR), 3. Fonemsubtraktion (t.ex. 'Ta bort K i början' för KRAM -> RAM, 'Ta bort M i mitten' för SMAL -> SAL, 'Ta bort D i slutet' för BILD -> BIL). Inkludera ursprungsordet, en tydlig instruktion, mål-ordet, och 3 svarsalternativ (mål-ordet + 2 bra distraktioner som helst är riktiga ord). Returnera resultatet som en JSON-array."
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    originalWord: { type: "STRING", description: "Ordet i versaler" },
                    instruction: { type: "STRING", description: "Instruktionen, t.ex. 'Byt ut K mot P'" },
                    targetWord: { type: "STRING", description: "Målordet i versaler" },
                    options: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      description: "Målordet plus två felaktiga men rimliga alternativ (totalt 3 ord i versaler)"
                    }
                  },
                  required: ["originalWord", "instruction", "targetWord", "options"]
                }
              }
            }
          })
        }
      );

      if (!response.ok) throw new Error("Kunde inte generera nya nivåer");

      const data = await response.json();
      const newLevelsText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (newLevelsText) {
        const newLevels = JSON.parse(newLevelsText);
        setLevels(newLevels);
        setCurrentLevel(0);
        setScore(0);
        setGameOver(false);
        setFeedback(null);
        speak("Hokus pokus! Nya magiska ord är redo.");
      }
    } catch (error) {
      console.error("Misslyckades med att hämta magiska ord:", error);
      speak("Oj, magin fungerade inte. Vi kör en vanlig runda istället!");
      restartGame();
    } finally {
      setIsGeneratingLevels(false);
    }
  };

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-white">
          <Trophy className="w-24 h-24 mx-auto text-yellow-400 mb-4 animate-bounce drop-shadow-md" />
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">Grattis!</h1>
          <p className="text-xl text-slate-600 mb-6 font-medium">
            Du fick <strong className="text-4xl text-blue-600 drop-shadow-sm">{score}</strong> av {levels.length} stjärnor!
          </p>
          <p className="text-lg text-purple-600 mb-8 font-bold">Du är en riktig ordmagiker!</p>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={restartGame}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl shadow-sm border-2 border-slate-200 transition-all flex items-center justify-center gap-2 text-xl hover:scale-[1.02]"
            >
              <RefreshCw className="w-6 h-6 text-blue-500" /> Spela Samma Ord Igen
            </button>

            <button 
              onClick={generateNewLevels}
              disabled={isGeneratingLevels}
              className={`w-full font-bold py-4 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-xl text-white
                ${isGeneratingLevels ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:scale-[1.02] shadow-pink-500/30'}`}
            >
              {isGeneratingLevels ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Hämtar ny magi...</>
              ) : (
                <><Wand2 className="w-6 h-6 text-pink-200" /> ✨ Nya Magiska Ord ✨</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 bg-white/95 backdrop-blur p-4 rounded-2xl shadow-lg border border-white/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 hidden sm:block">Ordmagikern</h1>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-200 px-4 py-2 rounded-xl shadow-sm">
          <Star className="w-6 h-6 text-yellow-400 fill-current drop-shadow-sm" />
          <span className="text-xl font-bold text-yellow-600">{score} <span className="text-yellow-400">/</span> {levels.length}</span>
        </div>
      </div>

      {/* Spelplan */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border-b-8 border-blue-200 relative overflow-hidden">
        
        {/* Nivåindikator */}
        <div className="text-center text-sm font-extrabold text-blue-400 uppercase tracking-widest mb-6">
          Ord {currentLevel + 1} av {levels.length}
        </div>

        {/* Ursprungsord */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-4 border-blue-100 rounded-3xl p-8 mb-4 w-full text-center relative shadow-inner">
            <button 
              onClick={() => speak(level.originalWord)}
              disabled={isGeneratingAudio}
              className={`absolute top-4 right-4 p-3 rounded-full transition-all ${
                isGeneratingAudio ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-200 text-blue-700 hover:bg-blue-300 hover:scale-110 shadow-sm'
              }`}
              title="Lyssna på ordet"
            >
              <Volume2 className={`w-6 h-6 ${isGeneratingAudio ? 'animate-pulse' : ''}`} />
            </button>
            <h2 className="text-6xl sm:text-7xl font-black text-blue-700 tracking-widest uppercase drop-shadow-sm">
              {level.originalWord}
            </h2>
          </div>
          
          {/* Instruktion */}
          <div className="flex items-center justify-center gap-4 bg-purple-100 text-purple-800 px-6 py-4 rounded-2xl shadow-sm border-2 border-purple-200 w-full sm:w-auto">
            <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
            <p className="text-xl sm:text-2xl font-bold text-center">
              {level.instruction}
            </p>
            <button 
              onClick={() => speak(level.instruction)}
              disabled={isGeneratingAudio}
              className={`p-2 rounded-full transition-all ${
                isGeneratingAudio ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-purple-200 text-purple-700 hover:bg-purple-300 hover:scale-110'
              }`}
              title="Lyssna på instruktionen"
            >
              <Volume2 className={`w-5 h-5 ${isGeneratingAudio ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-center mb-6">
           <ArrowRight className="w-10 h-10 text-blue-200" />
        </div>

        {/* Svarsalternativ */}
        {!showOptions ? (
          <button 
            onClick={() => setShowOptions(true)}
            className="w-full flex flex-col items-center justify-center py-8 bg-indigo-50 hover:bg-indigo-100 rounded-2xl border-4 border-dashed border-indigo-300 transition-all duration-300 transform hover:scale-[1.02] min-h-[160px] cursor-pointer group shadow-sm"
          >
            <Sparkles className="w-12 h-12 text-indigo-400 mb-3 group-hover:scale-125 transition-transform duration-300" />
            <p className="text-xl font-extrabold text-indigo-700">Tänk ut ordet själv först!</p>
            <p className="text-lg font-bold text-indigo-400 mt-2">Klicka här för att visa alternativen</p>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {shuffledOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                disabled={feedback !== null}
                className={`
                  relative px-6 py-6 text-3xl font-black rounded-2xl border-b-8 transition-all duration-200 transform
                  ${feedback === 'correct' && option === level.targetWord 
                    ? 'bg-emerald-400 border-emerald-600 text-white scale-105 shadow-lg' 
                    : feedback === 'incorrect' && option === level.targetWord
                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50'
                    : feedback === 'incorrect' 
                    ? 'bg-rose-500 border-rose-700 text-white animate-shake'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 active:border-b-0 active:translate-y-2 shadow-sm'
                  }
                `}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Feedback Animation (Overlay) */}
        {feedback === 'correct' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-3xl z-10">
             <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white rounded-full p-8 shadow-2xl animate-bounce border-4 border-white">
                <Star className="w-24 h-24 fill-current drop-shadow-md" />
             </div>
          </div>
        )}

      </div>
      
      {/* Tips för lärare/föräldrar */}
      <p className="mt-8 text-sm font-medium text-white/90 max-w-lg text-center bg-black/10 backdrop-blur p-4 rounded-xl">
        <strong>Tips:</strong> Använd högtalarikonerna för att få orden upplästa. Detta kopplar ihop bokstav med ljud och stärker den fonologiska medvetenheten!
      </p>

    </div>
  );
}
