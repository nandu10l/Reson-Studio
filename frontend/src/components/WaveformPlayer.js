import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";

const WaveformPlayer = ({ audioUrl }) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#94a3b8",
        progressColor: "#6366f1",
        cursorColor: "#6366f1",
        barWidth: 2,
        height: 60,
      });

      wavesurfer.current.load(audioUrl);

      wavesurfer.current.on("finish", () => setIsPlaying(false));
    }

    return () => wavesurfer.current?.destroy();
  }, [audioUrl]);

  const togglePlay = () => {
    wavesurfer.current.playPause();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="w-full flex items-center gap-4">
      <button
        onClick={togglePlay}
        className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>
      <div className="flex-1" ref={waveformRef}></div>
    </div>
  );
};

export default WaveformPlayer;
