import React from "react";
import WaveformPlayer from "./WaveformPlayer";

const ProjectCard = ({ project }) => (
  <div className="bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition">
    <h3 className="font-semibold text-lg">{project.title}</h3>
    <p className="text-gray-500 text-sm mb-3">{project.date}</p>
    <WaveformPlayer audioUrl={project.audioUrl} />
  </div>
);

export default ProjectCard;
