import React, { useState } from 'react';
import { X } from 'lucide-react';

function NewProjectModal({ isOpen, onClose, onCreateProject }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [bpm, setBpm] = useState(120);
  const [sampleRate, setSampleRate] = useState(44100);
  const [bitDepth, setBitDepth] = useState(24);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Project name is required');
      return;
    }
    onCreateProject({
      name: projectName,
      description,
      bpm: parseInt(bpm, 10),
      sampleRate: parseInt(sampleRate, 10),
      bitDepth: parseInt(bitDepth, 10),
    });
    onClose();
    // Reset form
    setProjectName('');
    setDescription('');
    setBpm(120);
    setSampleRate(44100);
    setBitDepth(24);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="projectName">Project Name *</label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional project description"
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="bpm">BPM</label>
                <input
                  type="number"
                  id="bpm"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  min="60"
                  max="200"
                />
              </div>
              <div className="form-group">
                <label htmlFor="sampleRate">Sample Rate (Hz)</label>
                <select
                  id="sampleRate"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                >
                  <option value={22050}>22050</option>
                  <option value={44100}>44100</option>
                  <option value={48000}>48000</option>
                  <option value={96000}>96000</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="bitDepth">Bit Depth</label>
                <select
                  id="bitDepth"
                  value={bitDepth}
                  onChange={(e) => setBitDepth(e.target.value)}
                >
                  <option value={16}>16-bit</option>
                  <option value={24}>24-bit</option>
                  <option value={32}>32-bit</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn small primary-btn">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewProjectModal;
